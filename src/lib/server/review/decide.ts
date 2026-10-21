import { error } from '@sveltejs/kit';
import { privateProvider } from '$private';
import { readDecisionForm } from '$lib/review/decisionForm';
import {
	collaboratorNotesFor,
	decisionProblems,
	type Decision,
	type RuleField
} from '$lib/review/reviewRules';
import type { ActionOutcome, DecisionResult } from '$lib/review/reviewTypes';
import { withoutPeople } from '$lib/review/settlement';
import { previewSettlement } from '$lib/review/settlementPreview';
import { hasAllPermissions, isSelfReview } from '$lib/server/authz';
import { canActOnSubmission } from '$lib/server/claims';
import { db } from '$lib/server/db';
import { dispatchReviewWebhook, outboundEvent } from '$lib/server/outbound';
import { shipAuthorName } from '$lib/server/serialize';
import { evidenceFromRows, reviewColumns } from '$lib/server/settlementStore';
import { teardownVms } from '$lib/server/vm';
import {
	assertAccess,
	assertTrack,
	done,
	reauthRefusal,
	refuse,
	refuseProblems,
	selfReviewRefusal,
	shipVmIds
} from '$lib/server/review/guards';
import {
	decisionKind,
	decisionMeta,
	decisionVerb,
	settlementInclude
} from '$lib/server/review/settlementRows';

async function approvalRequirements(ship: {
	programId: string;
	externalId: string;
	version: number;
	track: 'software' | 'hardware';
}) {
	const [fields, checklistCount, priorReviews] = await Promise.all([
		db.reviewField.findMany({
			where: { programId: ship.programId, required: true, tracks: { has: ship.track } },
			select: { key: true, label: true, type: true, required: true }
		}),
		db.checklistItem.count({ where: { programId: ship.programId, tracks: { has: ship.track } } }),
		// only the newest decision on an earlier ship counts: older request rounds are superseded
		db.review.findMany({
			where: {
				submission: {
					programId: ship.programId,
					externalId: ship.externalId,
					version: { lt: ship.version }
				}
			},
			orderBy: { createdAt: 'desc' },
			take: 1,
			select: { id: true, decision: true }
		})
	]);
	return {
		fields: fields as RuleField[],
		checklistCount,
		requiredFixIds: priorReviews[0]?.decision === 'changes' ? [priorReviews[0].id] : []
	};
}

export async function decideShip(
	decision: Decision,
	user: App.SessionUser,
	programId: string,
	submissionId: string,
	form: FormData
): Promise<ActionOutcome<DecisionResult>> {
	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId },
		include: {
			maker: true,
			program: {
				select: {
					secondPass: true,
					secondPassApproved: true,
					secondPassChanges: true,
					secondPassRejected: true,
					secondPassOrganizerBypass: true,
					allowDeflation: true,
					hoursJustification: true,
					reviewersCannotReviewOwnProjects: true
				}
			},
			...settlementInclude
		}
	});
	if (!ship) throw error(404, 'Submission not found');
	assertAccess(user, ship.programId);
	assertTrack(user, ship.programId, ship.track);
	if (ship.program.reviewersCannotReviewOwnProjects && isSelfReview(user, ship, ship.programId))
		return selfReviewRefusal();

	// a direct post on an unclaimed ship would otherwise skip the step-up the claim enforces
	const reauth = await reauthRefusal(user, programId, submissionId);
	if (reauth.refusal) return reauth.refusal;

	const { draft, ingestVersion } = readDecisionForm(form);
	const note = draft.note;
	const audit = draft.audit;
	const justification = {
		technicalFeatures: draft.technicalFeatures.trim(),
		deflationReason: draft.deflationReason.trim()
	};
	const collaboratorNotes = collaboratorNotesFor(
		draft.collaboratorNotes,
		ship.collaborators.map((collaborator) => collaborator.makerId)
	);

	// settled from the evidence and the posted reductions: a client total is never read
	const excluded = await privateProvider.excludedMakers({
		submissionId: ship.id,
		programId: ship.programId
	});
	const evidence = withoutPeople(
		evidenceFromRows(ship),
		excluded.map((person) => person.makerId)
	);
	const preview = previewSettlement(evidence, {
		adjustments: draft.adjustments,
		deflateSeconds: draft.deflateSeconds,
		collaboratorDeflates: draft.collaboratorDeflates,
		allowDeflation: ship.program.allowDeflation
	});

	const approving = decision === 'approved';
	const requirements = approving
		? await approvalRequirements(ship)
		: { fields: [], checklistCount: 0, requiredFixIds: [] };
	const problems = decisionProblems({
		decision,
		status: ship.status,
		program: { hoursJustification: ship.program.hoursJustification },
		checklist: { count: requirements.checklistCount, checks: draft.checks },
		fields: { definitions: requirements.fields, values: draft.fieldValues },
		fixes: { requiredIds: requirements.requiredFixIds, confirmedIds: draft.fixChecks },
		notes: { note, audit, ...justification },
		settlement: preview.settlement,
		deflateSeconds: preview.deflateSeconds,
		viewer: { canAct: await canActOnSubmission(ship.id, user.id) }
	});
	if (problems.length) return refuseProblems(problems);

	const shipRef = { submissionId: ship.id, programId: ship.programId };
	const gate = await privateProvider.beforeDecision(shipRef);
	if (gate.blocked)
		return refuse(409, 'blocked', gate.message ?? 'This ship can no longer be decided.');

	const heldKinds = {
		approved: ship.program.secondPassApproved,
		changes: ship.program.secondPassChanges,
		rejected: ship.program.secondPassRejected
	};
	// only the people running the program skip the hold. a granular second-pass grant makes
	// someone a confirmer of others' decisions, not exempt from oversight themselves
	const organizerBypass =
		ship.program.secondPassOrganizerBypass && hasAllPermissions(user, ship.programId);
	const hold = ship.program.secondPass && heldKinds[decision] && !organizerBypass;
	const parked = hold && (await privateProvider.routeHeldDecision(shipRef, decision)) === 'park';
	const outcome = parked ? 'parked' : hold ? 'held' : 'final';

	const vmids = await shipVmIds(ship.id);
	const columns = reviewColumns(preview.settlement, {
		deflateSeconds: preview.deflateSeconds,
		collaboratorDeflates: preview.collaboratorDeflates
	});

	// a correction bumps ingestVersion: a decision judged against replaced data must lose
	const seenIngestVersion = ingestVersion ?? ship.ingestVersion;
	const decided = await db.$transaction(async (transaction) => {
		const updated = await transaction.submission.updateMany({
			where: { id: ship.id, status: 'pending', ingestVersion: seenIngestVersion },
			data: {
				status: parked ? 'fraudreview' : hold ? 'secondpass' : decision,
				claimedById: null,
				claimedAt: null
			}
		});
		if (updated.count === 0) return false;

		await transaction.review.create({
			data: {
				submissionId: ship.id,
				reviewerId: user.id,
				decision,
				...columns,
				collaboratorNotes,
				noteToMaker: note,
				auditNote: audit,
				...justification,
				fieldValues: draft.fieldValues,
				checklist: draft.checks,
				// exactly the required set: anything else the client posted is noise
				fixChecks: requirements.requiredFixIds
			}
		});
		await transaction.activityEvent.create({
			data: {
				programId: ship.programId,
				kind: decisionKind[decision],
				actorId: user.id,
				submissionId: ship.id,
				text: parked
					? `${decisionVerb[decision]} ${ship.title} (pending fraud review)`
					: hold
						? `${decisionVerb[decision]} ${ship.title} (pending second pass)`
						: `${decisionVerb[decision]} ${ship.title}`,
				meta: {
					decision,
					...(parked ? { fraudReview: 'pending' } : hold ? { secondPass: 'pending' } : {}),
					...decisionMeta(preview.settlement.approvedSeconds, preview.settlement.breakdown),
					title: ship.title,
					maker: shipAuthorName(ship, ship.maker),
					// emails, not names: the activity feed resolves them to mentions
					...(ship.collaborators.length
						? { collaborators: ship.collaborators.map((collaborator) => collaborator.maker.email) }
						: {}),
					hasNote: note.trim().length > 0,
					hasAudit: audit.trim().length > 0
				}
			}
		});
		await transaction.draft.deleteMany({ where: { submissionId: ship.id, reviewerId: user.id } });
		await transaction.reviewerVm.deleteMany({ where: { submissionId: ship.id } });
		await transaction.submissionOpen.updateMany({
			where: { submissionId: ship.id, reviewerId: user.id, closedAt: null },
			data: { closedAt: new Date(), closeReason: 'decided' }
		});
		return true;
	});
	if (!decided)
		return refuse(
			409,
			'staleIngest',
			'This ship was updated while you were reviewing it. Refresh and review the latest data.'
		);

	teardownVms(vmids);
	void privateProvider
		.afterDecision(shipRef, decision, outcome)
		.catch((hookError) => console.error(`[review] after-decision hook for ${ship.id}`, hookError));

	// a held decision tells the program nothing until an organizer confirms it
	const webhook = hold
		? null
		: await dispatchReviewWebhook({
				event: outboundEvent[decision],
				decision,
				programId: ship.programId,
				submissionId: ship.id,
				reviewerId: user.id,
				note,
				auditNote: audit,
				approvedSeconds: preview.reported.approvedSeconds,
				secondsBreakdown: preview.reported.breakdown,
				collaboratorSeconds: ship.collaborators.length ? preview.reported.collaborators : undefined,
				collaboratorNotes: Object.keys(collaboratorNotes).length ? collaboratorNotes : undefined,
				fields: draft.fieldValues as Record<string, unknown>,
				...justification
			});

	return done({
		success: true,
		decision,
		outcome,
		approvedSeconds: preview.reported.approvedSeconds,
		webhook
	});
}
