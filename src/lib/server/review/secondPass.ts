import { privateProvider } from '$private';
import { minutesToSeconds } from '$lib/time';
import { confirmProblems } from '$lib/review/reviewRules';
import type { ActionOutcome, ConfirmResult } from '$lib/review/reviewTypes';
import { withoutPeople } from '$lib/review/settlement';
import { previewSettlement } from '$lib/review/settlementPreview';
import { isSelfReview, requirePermission } from '$lib/server/authz';
import { db } from '$lib/server/db';
import { dispatchReviewWebhook, outboundEvent } from '$lib/server/outbound';
import { replayLegacyReview } from '$lib/server/outboundRedispatch';
import { shipAuthorName } from '$lib/server/serialize';
import { evidenceFromRows, reviewColumns } from '$lib/server/settlementStore';
import { teardownVms } from '$lib/server/vm';
import {
	assertTrack,
	done,
	refuse,
	refuseProblems,
	selfReviewRefusal,
	shipVmIds
} from '$lib/server/review/guards';
import { isSecondsReview, storedTimeRequest } from '$lib/server/review/heldReview';
import { readConfirmEdits } from '$lib/server/review/secondPassEdits';
import {
	decisionKind,
	decisionMeta,
	decisionVerb,
	settlementInclude
} from '$lib/server/review/settlementRows';

const heldNoun = {
	approved: 'approval',
	changes: 'changes request',
	rejected: 'rejection'
} as const;

// key order must not decide whether two requests are the same
function canonical(value: unknown): string {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value);
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, entry]) => !(entry && typeof entry === 'object' && !Object.keys(entry).length))
		.sort(([first], [second]) => first.localeCompare(second));
	return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
}

export async function confirmSecondPass(
	user: App.SessionUser,
	programId: string,
	submissionId: string,
	form: FormData | null
): Promise<ActionOutcome<ConfirmResult>> {
	requirePermission(user, programId, 'SECOND_PASS');

	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId, status: 'secondpass' },
		include: {
			maker: true,
			program: {
				select: {
					allowDeflation: true,
					hoursJustification: true,
					reviewersCannotReviewOwnProjects: true
				}
			},
			...settlementInclude,
			reviews: { orderBy: { createdAt: 'desc' }, take: 1 }
		}
	});
	if (!ship)
		return refuse(404, 'notAwaitingSecondPass', 'This ship is no longer awaiting second pass.');
	assertTrack(user, programId, ship.track);
	if (ship.program.reviewersCannotReviewOwnProjects && isSelfReview(user, ship, programId))
		return selfReviewRefusal();
	const review = ship.reviews[0];
	if (!review) return refuse(409, 'noReview', 'No recorded review to confirm.');
	const madeHeldDecision = review.reviewerId === user.id;

	const shipRef = { submissionId: ship.id, programId };
	if (!madeHeldDecision) {
		const gate = await privateProvider.beforeDecision(shipRef);
		if (gate.blocked)
			return refuse(409, 'blocked', gate.message ?? 'This ship can no longer be decided.');
	}

	const held = storedTimeRequest(review);
	const edits = await readConfirmEdits(
		form,
		review,
		held,
		programId,
		ship.collaborators.map((collaborator) => collaborator.makerId)
	);

	const allowDeflation = ship.program.allowDeflation;
	const evidence = withoutPeople(
		evidenceFromRows(ship),
		(await privateProvider.excludedMakers(shipRef)).map((person) => person.makerId)
	);
	const preview = previewSettlement(evidence, { ...edits.time, allowDeflation });
	const heldPreview = previewSettlement(evidence, { ...held, allowDeflation: true });
	const timeChanged =
		canonical(preview.settlement.adjustments) !== canonical(heldPreview.settlement.adjustments) ||
		preview.deflateSeconds !== heldPreview.deflateSeconds ||
		canonical(preview.collaboratorDeflates) !== canonical(heldPreview.collaboratorDeflates);

	// a review the old app recorded replays under its own minute model until its time is edited:
	// an edit re-settles it in seconds and the row becomes version 3
	const legacy = !isSecondsReview(review) && !timeChanged ? replayLegacyReview(ship, review) : null;

	const problems = confirmProblems({
		heldDecision: review.decision,
		decision: edits.decision,
		status: ship.status,
		program: { hoursJustification: ship.program.hoursJustification },
		notes: {
			note: edits.texts.noteToMaker,
			technicalFeatures: edits.texts.technicalFeatures,
			deflationReason: edits.texts.deflationReason
		},
		settlement: legacy ? { adjustments: legacy.settled.adjustments } : preview.settlement,
		deflateSeconds: legacy ? review.deflateMinutes : preview.deflateSeconds,
		viewer: { canSecondPass: true, madeHeldDecision }
	});
	if (problems.length) return refuseProblems(problems);

	// a resync while held changes the evidence under unchanged adjustments
	const rewriteTime =
		!legacy && (timeChanged || preview.settlement.approvedSeconds !== review.approvedSeconds);
	const edited =
		edits.textsChanged ||
		edits.fieldsChanged ||
		edits.decisionChanged ||
		edits.collaboratorNotesChanged ||
		timeChanged;

	const vmids = await shipVmIds(ship.id);
	const confirmed = await db.$transaction(async (transaction) => {
		// only the transaction that flips the status sends the webhook
		const updated = await transaction.submission.updateMany({
			where: {
				id: ship.id,
				status: 'secondpass',
				ingestVersion: edits.ingestVersion ?? ship.ingestVersion
			},
			data: { status: edits.decision }
		});
		if (updated.count === 0) return false;
		await transaction.reviewerVm.deleteMany({ where: { submissionId: ship.id } });
		if (edited || rewriteTime) {
			await transaction.review.update({
				where: { id: review.id },
				data: {
					...edits.texts,
					fieldValues: edits.fieldValues as object,
					...(edits.decisionChanged ? { decision: edits.decision } : {}),
					...(edits.collaboratorNotesChanged ? { collaboratorNotes: edits.collaboratorNotes } : {}),
					...(rewriteTime
						? reviewColumns(preview.settlement, {
								deflateSeconds: preview.deflateSeconds,
								collaboratorDeflates: preview.collaboratorDeflates
							})
						: {})
				}
			});
		}
		await transaction.activityEvent.create({
			data: {
				programId,
				kind: decisionKind[edits.decision],
				actorId: user.id,
				submissionId: ship.id,
				text: edits.decisionChanged
					? `${decisionVerb[edits.decision]} ${ship.title} (second pass)`
					: `Confirmed ${heldNoun[edits.decision]} of ${ship.title}`,
				meta: {
					op: edits.decisionChanged ? 'second-pass-overridden' : 'second-pass-confirmed',
					decision: edits.decision,
					...(edits.decisionChanged ? { heldDecision: review.decision } : {}),
					...(legacy
						? {
								approvedMinutes: legacy.settled.approvedMinutes,
								breakdown: legacy.settled.breakdown
							}
						: decisionMeta(preview.settlement.approvedSeconds, preview.settlement.breakdown)),
					title: ship.title,
					maker: shipAuthorName(ship, ship.maker),
					// the reviewer whose decision this resolves, not the confirming organizer
					reviewerId: review.reviewerId,
					...(edited ? { editedAtConfirm: true } : {})
				}
			}
		});
		return true;
	});
	if (!confirmed)
		return refuse(
			409,
			'staleIngest',
			'This ship was updated or is no longer awaiting second pass. Refresh before acting.'
		);

	teardownVms(vmids);

	const hasCollaborators = ship.collaborators.length > 0;
	const webhook = await dispatchReviewWebhook({
		event: outboundEvent[edits.decision],
		decision: edits.decision,
		programId,
		submissionId: ship.id,
		reviewerId: review.reviewerId,
		note: edits.texts.noteToMaker,
		auditNote: edits.texts.auditNote,
		...(legacy
			? {
					approvedMinutes: legacy.reported.approvedMinutes,
					minutesBreakdown: legacy.reported.breakdown,
					collaboratorMinutes: hasCollaborators ? legacy.reported.collaborators : undefined
				}
			: {
					approvedSeconds: preview.reported.approvedSeconds,
					secondsBreakdown: preview.reported.breakdown,
					collaboratorSeconds: hasCollaborators ? preview.reported.collaborators : undefined
				}),
		collaboratorNotes: Object.keys(edits.collaboratorNotes).length
			? edits.collaboratorNotes
			: undefined,
		fields: edits.fieldValues,
		technicalFeatures: edits.texts.technicalFeatures,
		deflationReason: edits.texts.deflationReason,
		// a confirm never edits these: a review from the earlier flow sends what it stored
		timeEvidence: review.timeEvidence,
		supportingEvidence: review.supportingEvidence,
		hoursReasoning: review.hoursReasoning,
		additionalJustification: review.additionalJustification
	});

	void privateProvider
		.afterDecision(shipRef, edits.decision, 'final')
		.catch((hookError) => console.error(`[review] after-decision hook for ${ship.id}`, hookError));

	return done({
		success: true,
		decision: edits.decision,
		overridden: edits.decisionChanged,
		approvedSeconds: legacy
			? minutesToSeconds(legacy.reported.approvedMinutes)
			: preview.reported.approvedSeconds,
		webhook
	});
}
