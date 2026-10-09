import { error } from '@sveltejs/kit';
import type { ActionOutcome } from '$lib/review/reviewTypes';
import { requirePermission } from '$lib/server/authz';
import { canActOnSubmission } from '$lib/server/claims';
import { db } from '$lib/server/db';
import { triggerReenrich } from '$lib/server/webhooks';
import { assertAccess, assertCanAct, done, lockedRefusal, refuse } from '$lib/server/review/guards';

export async function resyncShip(
	user: App.SessionUser,
	programId: string,
	submissionId: string
): Promise<ActionOutcome<{ success: true; version: number }>> {
	await assertCanAct(user, programId, submissionId);
	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId },
		select: { id: true, title: true, status: true, enrichmentVersion: true }
	});
	if (!ship) throw error(404, 'Submission not found');
	// a held ship is the one closed status that resyncs: confirming re-settles from the evidence
	if (ship.status === 'secondpass') requirePermission(user, programId, 'SECOND_PASS');
	else if (ship.status !== 'pending')
		return refuse(400, 'shipClosed', 'Only a ship waiting for review can be resynced.');
	if (!(await canActOnSubmission(ship.id, user.id))) return lockedRefusal();

	const trigger = await triggerReenrich(ship.id);
	if (!trigger.ok) return refuse(502, 'resyncFailed', trigger.message);

	await db.activityEvent.create({
		data: {
			programId,
			kind: 'EVIDENCE',
			actorId: user.id,
			submissionId: ship.id,
			text: `Requested an evidence resync of ${ship.title}`,
			meta: { op: 'evidence-resync', fromVersion: ship.enrichmentVersion }
		}
	});
	return done({ success: true, version: ship.enrichmentVersion });
}

// read-only: the capture landed once the version moves past the one resync returned
export async function resyncStatus(
	user: App.SessionUser | null,
	programId: string,
	submissionId: string
): Promise<ActionOutcome<{ version: number }>> {
	if (!user) return refuse(401, 'signedOut', 'Signed out.');
	assertAccess(user, programId);
	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId },
		select: { enrichmentVersion: true }
	});
	if (!ship) throw error(404, 'Submission not found');
	return done({ version: ship.enrichmentVersion });
}
