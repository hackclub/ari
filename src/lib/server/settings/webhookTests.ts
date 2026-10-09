import { createHmac } from 'node:crypto';
import { db } from '$lib/server/db';
import { decrypt } from '$lib/server/crypto';
import { notifyDelivery } from '$lib/server/outbound';
import { isSafeOutboundUrl } from '$lib/server/outboundSigning';
import { webhooksBaseUrl } from '$lib/server/webhooks';
import { activeIngestSecret } from './secrets';
import type { SettingsResult } from './save';

const refuse = (status: number, error: string): SettingsResult => ({ ok: false, status, error });

// the ingest service verifies the signature and short-circuits this reserved payload: no ship,
// no activity event, only a row in the delivery log
export async function sendTestPing(programId: string): Promise<SettingsResult> {
	const secret = await activeIngestSecret(programId);
	if (!secret) return refuse(400, 'No signing secret yet. Generate one first.');
	const baseUrl = webhooksBaseUrl();
	if (!baseUrl) return refuse(503, 'Webhook ingestion is not configured on this deployment.');

	const body = JSON.stringify({
		external_id: 'test-ping',
		title: 'Test ping',
		maker: { email: 'test@ping.local' },
		repo_url: 'https://example.com/test',
		hours: 1
	});
	// timestamped form: the signature covers `${timestamp}.${body}` and expires with the timestamp
	const timestampSeconds = Math.floor(Date.now() / 1000);
	const signature = createHmac('sha256', decrypt(secret.secretEnc))
		.update(`${timestampSeconds}.${body}`)
		.digest('hex');
	try {
		await fetch(`${baseUrl}/api/ingest/${programId}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-ari-timestamp': String(timestampSeconds),
				'x-ari-signature': signature
			},
			body
		});
	} catch {
		return refuse(502, 'Could not reach the ingest endpoint. Try again in a moment.');
	}
	return { ok: true };
}

function sampleReviewPayload(program: { collaborative: boolean; priorityReview: boolean } | null) {
	return {
		event: 'review.approved',
		decision: 'approved',
		id: 'TEST-0000',
		external_id: 'test-ping',
		// shown as true: the case an integration handles specially
		...(program?.priorityReview ? { priority: true } : {}),
		maker: { email: 'test@ping.local', slack_id: null },
		...(program?.collaborative
			? {
					collaborators: [
						{
							email: 'test@ping.local',
							name: 'Test Maker',
							slack_id: null,
							hackatime_id: null,
							note_to_maker: 'A personal note for this person (test).',
							approved_minutes: 60,
							approved_hours: 1,
							minutes_breakdown: { hackatime: 45, journals: 15, lapse: 0, program: 0 }
						}
					]
				}
			: {}),
		review: {
			approved_hours: 1,
			note_to_maker: 'This is a test event from ari.',
			audit_note: 'Internal reviewer note (test).',
			fields: [{ key: 'example', label: 'Example field', type: 'text', value: 'sample' }],
			reviewer: { email: 'reviewer@ping.local', slack_id: null }
		}
	};
}

export async function sendTestOutbound(programId: string): Promise<SettingsResult> {
	const [endpoint, program] = await Promise.all([
		db.outboundEndpoint.findUnique({ where: { programId } }),
		db.program.findUnique({
			where: { id: programId },
			select: { collaborative: true, priorityReview: true }
		})
	]);
	if (!endpoint?.url) return refuse(400, 'Set a destination URL first.');
	if (!isSafeOutboundUrl(endpoint.url)) {
		return refuse(
			400,
			'That webhook host is not allowed. Use a public address, not localhost or a private/internal one.'
		);
	}
	if (!endpoint.secretEnc) return refuse(400, 'Generate an outbound secret first.');
	try {
		// a row the sender can never sign would only fail later
		decrypt(endpoint.secretEnc);
	} catch {
		return refuse(400, 'The outbound secret could not be read. Generate a new one.');
	}

	const delivery = await db.outboundDelivery.create({
		data: {
			programId,
			event: 'review.approved',
			// sentinel id: keeps a failed test event out of the audit log
			submissionId: 'TEST-0000',
			url: endpoint.url,
			status: 'PENDING',
			payload: JSON.stringify(sampleReviewPayload(program))
		}
	});
	// ari-webhooks sends it; the log shows the result on the next load
	await notifyDelivery(delivery.id);
	return { ok: true };
}
