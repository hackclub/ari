import type { trackWhere } from '$lib/server/authz';
import { db } from '$lib/server/db';
import { secondsBetween } from '$lib/time';

type DecisionMeta = { secondPass?: unknown; fraudReview?: unknown; auto?: unknown };

// an even count takes the lower middle, so the result is always a duration that happened
export function medianSeconds(durations: number[]): number | null {
	if (durations.length === 0) return null;
	const sorted = [...durations].sort((first, second) => first - second);
	return sorted[Math.floor((sorted.length - 1) / 2)];
}

export async function reviewTime(
	programId: string,
	since: Date,
	scopeWhere: ReturnType<typeof trackWhere> = {}
): Promise<{ medianSeconds: number | null; decisions: number }> {
	const events = await db.activityEvent.findMany({
		where: {
			programId,
			createdAt: { gte: since },
			kind: { in: ['APPROVED', 'CHANGES', 'REJECTED'] },
			submissionId: { not: null }
		},
		orderBy: { createdAt: 'asc' },
		select: { submissionId: true, createdAt: true, meta: true }
	});

	// a held or parked decision tells the program nothing: the confirm or override that
	// follows is the event written when the webhook goes out
	const finalBySubmission = new Map<string, { decidedAt: Date; automated: boolean }>();
	for (const event of events) {
		if (!event.submissionId) continue;
		const meta = (event.meta ?? {}) as DecisionMeta;
		if (meta.secondPass === 'pending' || meta.fraudReview === 'pending') continue;
		finalBySubmission.set(event.submissionId, {
			decidedAt: event.createdAt,
			automated: meta.auto === true
		});
	}
	if (finalBySubmission.size === 0) return { medianSeconds: null, decisions: 0 };

	// the status filter drops a ship that was reverted, requeued or held again afterwards
	const ships = await db.submission.findMany({
		where: {
			programId,
			...scopeWhere,
			id: { in: [...finalBySubmission.keys()] },
			status: { in: ['approved', 'changes', 'rejected'] }
		},
		// ingestedAt, not queuedAt: queuedAt follows a backdated shipped_at
		select: { id: true, ingestedAt: true }
	});

	const durations: number[] = [];
	for (const ship of ships) {
		const final = finalBySubmission.get(ship.id);
		// the system account's automated decisions are not reviewer work
		if (!final || final.automated) continue;
		// a migrated decision is dated before its row arrived here: there is nothing to measure
		if (final.decidedAt < ship.ingestedAt) continue;
		durations.push(secondsBetween(ship.ingestedAt, final.decidedAt));
	}
	return { medianSeconds: medianSeconds(durations), decisions: durations.length };
}
