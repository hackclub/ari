import type { Prisma } from '$db';
import type { Adjustments } from '$lib/review/settlement';
import type {
	EarlierInputs,
	FieldValue,
	FixTarget,
	PastReview,
	RecordedDecision
} from '$lib/review/reviewTypes';
import { db } from '$lib/server/db';
import { whenLabel } from '$lib/server/serialize';
import {
	storedApprovedSeconds,
	storedDeductedSeconds,
	type SettlementRows
} from '$lib/server/settlementStore';
import { isSecondsReview, reportedSeconds, storedTimeRequest } from '$lib/server/review/heldReview';
import { closedStatuses, decidedStatuses, heldStatuses } from '$lib/server/review/guards';

const historyInclude = {
	reviewer: true,
	submission: { select: { id: true, version: true } }
} satisfies Prisma.ReviewInclude;

export type HistoryReview = Prisma.ReviewGetPayload<{ include: typeof historyInclude }>;

export const projectReviews = (programId: string, externalId: string): Promise<HistoryReview[]> =>
	db.review.findMany({
		where: { submission: { programId, externalId } },
		include: historyInclude,
		orderBy: { createdAt: 'desc' }
	});

type ShipKey = { id: string; status: string; version: number };

// only the newest decision on an earlier ship counts, and only when it asked for changes
export function fixTargets(
	reviews: HistoryReview[],
	ship: ShipKey,
	canViewReviewed: boolean
): FixTarget[] {
	const latestPrior = reviews.find((review) => review.submission.version < ship.version);
	if (latestPrior?.decision !== 'changes') return [];
	return [
		{
			reviewId: latestPrior.id,
			shipId: latestPrior.submission.id,
			version: latestPrior.submission.version,
			reviewerName: latestPrior.reviewer.name,
			when: whenLabel(latestPrior.createdAt),
			// the maker-visible note is shown to everyone: the fix cannot be verified without it
			note: latestPrior.noteToMaker,
			audit: canViewReviewed ? latestPrior.auditNote : null
		}
	];
}

export function pastReviewRows(
	reviews: HistoryReview[],
	ship: ShipKey,
	canViewReviewed: boolean,
	nameByMakerId: Map<string, string>
): PastReview[] {
	// the latest own review of a decided, held or parked ship is the recorded decision itself
	const hidesLatestOwn = [...decidedStatuses, 'secondpass', 'fraudreview'].includes(ship.status);
	const latestOwnId = reviews.find((review) => review.submissionId === ship.id)?.id;
	return reviews
		.filter(
			(review) => review.submissionId !== ship.id || !hidesLatestOwn || review.id !== latestOwnId
		)
		.map((review) => ({
			reviewId: review.id,
			shipId: review.submission.id,
			version: review.submission.version,
			decision: review.decision,
			reviewerName: review.reviewer.name,
			reviewerColor: review.reviewer.avatarColor,
			reviewerSlackId: review.reviewer.slackId,
			createdAt: review.createdAt.toISOString(),
			when: whenLabel(review.createdAt),
			// without VIEW_REVIEWED the row keeps who, when and what, and loses the substance
			approvedSeconds: canViewReviewed ? storedApprovedSeconds(review) : null,
			note: canViewReviewed ? review.noteToMaker : null,
			audit: canViewReviewed ? review.auditNote : null,
			collaboratorNotes: canViewReviewed
				? Object.entries((review.collaboratorNotes ?? {}) as Record<string, string>).map(
						([makerId, note]) => ({ name: nameByMakerId.get(makerId) ?? 'Collaborator', note })
					)
				: []
		}));
}

function earlierInputs(review: EarlierInputs): EarlierInputs | null {
	const inputs = {
		timeEvidence: review.timeEvidence,
		supportingEvidence: review.supportingEvidence,
		hoursReasoning: review.hoursReasoning,
		additionalJustification: review.additionalJustification
	};
	return Object.values(inputs).some((text) => text.trim()) ? inputs : null;
}

type ReplayRows = Parameters<typeof reportedSeconds>[1] & SettlementRows;

// the draft is gone once a ship is decided: the rail shows what was recorded instead
export function recordedDecision(
	reviews: HistoryReview[],
	ship: ShipKey,
	rows: ReplayRows,
	viewerId: string,
	liveDeductions?: Record<string, number>
): RecordedDecision | null {
	if (!closedStatuses.includes(ship.status)) return null;
	const stored = reviews.find((review) => review.submissionId === ship.id);
	if (!stored) return null;
	// a held decision is confirmed with the fixed cuts as they are now, so it shows them
	const own = heldStatuses.includes(ship.status)
		? { ...stored, deductionsSeconds: liveDeductions ?? null }
		: stored;
	const time = storedTimeRequest(own);
	return {
		reviewId: own.id,
		decision: own.decision,
		settlementVersion: own.settlementVersion,
		timeModel: isSecondsReview(own) ? 'seconds' : 'legacyMinutes',
		madeByViewer: own.reviewerId === viewerId,
		reviewerName: own.reviewer.name,
		decidedAt: own.createdAt.toISOString(),
		when: whenLabel(own.createdAt),
		approvedSeconds: storedApprovedSeconds(own),
		reported: reportedSeconds(own, rows),
		deductedSeconds: isSecondsReview(own) ? storedDeductedSeconds(own, rows) : 0,
		note: own.noteToMaker,
		audit: own.auditNote,
		technicalFeatures: own.technicalFeatures,
		deflationReason: own.deflationReason,
		earlierInputs: earlierInputs(own),
		adjustments: time.adjustments as Adjustments,
		deflateSeconds: time.deflateSeconds,
		collaboratorDeflates: time.collaboratorDeflates,
		collaboratorNotes: (own.collaboratorNotes ?? {}) as Record<string, string>,
		fieldValues: (own.fieldValues ?? {}) as Record<string, FieldValue>,
		checks: Array.isArray(own.checklist) ? own.checklist.map((tick) => tick === true) : [],
		fixChecks: Array.isArray(own.fixChecks)
			? own.fixChecks.filter((id): id is string => typeof id === 'string')
			: []
	};
}
