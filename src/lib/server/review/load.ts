import { error, redirect } from '@sveltejs/kit';
import { privateProvider } from '$private';
import type { RuleFieldType } from '$lib/review/reviewRules';
import type { ReviewPageData, ReviewVm } from '$lib/review/reviewTypes';
import { settle, withoutPeople } from '$lib/review/settlement';
import { canReviewProgram, hasAllPermissions, hasPermission } from '$lib/server/authz';
import { isClaimStale } from '$lib/server/claims';
import { decrypt } from '$lib/server/crypto';
import { db } from '$lib/server/db';
import { hasFreshReauth, reauthLoginUrl } from '$lib/server/reauth';
import { ago } from '$lib/server/serialize';
import { evidenceFromRows } from '$lib/server/settlementStore';
import { vmConfigured } from '$lib/server/vm';
import { draftFromRow } from '$lib/server/review/draft';
import {
	assertViewable,
	closedStatuses,
	decidedStatuses,
	viewerOf
} from '$lib/server/review/guards';
import { shipFileHours, shipPastProjects } from '$lib/server/review/loadExternal';
import {
	fixTargets,
	pastReviewRows,
	projectReviews,
	recordedDecision
} from '$lib/server/review/loadHistory';
import { shipNavigation } from '$lib/server/review/loadNavigation';
import {
	shipEvidence,
	shipHours,
	shipInclude,
	shipPeople,
	shipProjects,
	shipSummary
} from '$lib/server/review/loadShip';
import { runLiveChecks, warningRows } from '$lib/server/review/warnings';

export interface ReviewLoadInput {
	user: App.SessionUser;
	programId: string;
	submissionId: string;
	url: URL;
	meta: {
		color: string;
		excludeOwnProjects: boolean;
		reauthRequired: boolean;
		reauthTtlMinutes: number;
		reviewGoal: number;
		allowVms: boolean;
		allowDeflation: boolean;
		hoursJustification: boolean;
	};
}

// a corrupt blob or a rotated key must not break the screen: the reviewer can relaunch
function decryptOrNull(encrypted: string | null): string | null {
	if (!encrypted) return null;
	try {
		return decrypt(encrypted);
	} catch {
		return null;
	}
}

// the newest diagnostics of a capture that stayed partial, for the sync warning
async function captureIssue(submissionId: string) {
	const event = await db.activityEvent.findFirst({
		where: { submissionId, kind: 'EVIDENCE', meta: { path: ['source'], equals: 'capture' } },
		orderBy: { createdAt: 'desc' },
		select: { meta: true, createdAt: true }
	});
	if (!event) return null;
	const meta = (event.meta ?? {}) as { notes?: unknown; error?: unknown; exhausted?: unknown };
	return {
		when: ago(event.createdAt),
		notes: Array.isArray(meta.notes) ? meta.notes.map(String).slice(0, 10) : [], // 10: a chosen cap, enough for the sync warning
		error: typeof meta.error === 'string' ? meta.error : null,
		exhausted: meta.exhausted === true
	};
}

export async function loadReviewPage(input: ReviewLoadInput): Promise<ReviewPageData> {
	const { user, programId, meta, url } = input;
	const ship = await db.submission.findFirst({
		where: { id: input.submissionId, programId },
		include: shipInclude
	});
	if (!ship) throw error(404, 'Submission not found');
	assertViewable(user, programId, ship, meta.excludeOwnProjects);

	// another reviewer's live claim opens the ship read-only: the claim is untouched and every
	// mutating action is gated on holding it
	const claimable = ship.status === 'pending';
	const claimedByOther =
		claimable &&
		Boolean(ship.claimedById) &&
		ship.claimedById !== user.id &&
		!isClaimStale(ship.claimedAt);
	const canReview = canReviewProgram(user, programId);

	// opening an open ship to review it is the step-up moment. a read-only peek and a closed
	// ship are not reviewing. placed before anything that writes
	if (claimable && !claimedByOther && canReview && meta.reauthRequired) {
		const fresh = await hasFreshReauth(user.id, programId, meta.reauthTtlMinutes * 60000); // ms in a minute: 60 * 1000
		if (!fresh) throw redirect(303, reauthLoginUrl(programId, url.pathname + url.search));
	}

	const shipRef = { submissionId: ship.id, programId };
	const viewer = viewerOf(user, programId);
	const people = shipPeople(ship);
	const canViewReviewed = hasPermission(user, programId, 'VIEW_REVIEWED');
	const weekStart = new Date(Date.now() - 604800000); // 7 days: 7 * 24 * 60 * 60 * 1000

	const [
		program,
		checklist,
		customFields,
		snippets,
		draft,
		nav,
		reviews,
		vmRow,
		weekCount,
		fileHours,
		pastProjects,
		warnings,
		privatePanels,
		issue,
		excluded
	] = await Promise.all([
		db.program.findUniqueOrThrow({
			where: { id: programId },
			select: {
				secondPass: true,
				secondPassApproved: true,
				secondPassChanges: true,
				secondPassRejected: true,
				secondPassOrganizerBypass: true
			}
		}),
		db.checklistItem.findMany({ where: { programId }, orderBy: { order: 'asc' } }),
		db.reviewField.findMany({ where: { programId }, orderBy: { order: 'asc' } }),
		db.snippet.findMany({
			where: { programId },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, body: true }
		}),
		db.draft.findUnique({
			where: { submissionId_reviewerId: { submissionId: ship.id, reviewerId: user.id } }
		}),
		shipNavigation({
			user,
			programId,
			excludeOwnProjects: meta.excludeOwnProjects,
			ship,
			trackParam: url.searchParams.get('track')
		}),
		projectReviews(programId, ship.externalId),
		db.reviewerVm.findUnique({
			where: { submissionId_reviewerId: { submissionId: ship.id, reviewerId: user.id } }
		}),
		db.review.count({
			where: { reviewerId: user.id, submission: { programId }, createdAt: { gte: weekStart } }
		}),
		shipFileHours(ship.id),
		shipPastProjects(ship.id, people.knownByEmail),
		privateProvider.shipWarnings(shipRef, viewer),
		privateProvider.reviewPanelData(shipRef, viewer),
		ship.evidenceSyncedAt ? null : captureIssue(ship.id),
		privateProvider.excludedMakers(shipRef)
	]);

	const evidence = evidenceFromRows(ship);
	const captured = settle({}, evidence);
	const recorded = recordedDecision(reviews, ship, ship, user.id);
	const canSecondPass = hasPermission(user, programId, 'SECOND_PASS');
	const canOverride = hasPermission(user, programId, 'OVERRIDE_DECISIONS');
	const canUseVms = hasPermission(user, programId, 'USE_VMS');
	const operatesProgram = hasAllPermissions(user, programId);
	const decided = decidedStatuses.includes(ship.status);
	const closed = closedStatuses.includes(ship.status);
	const secondPass = ship.status === 'secondpass';
	const heldByViewer = secondPass && Boolean(recorded?.madeByViewer);
	const canEditHeld = canSecondPass && secondPass && !heldByViewer;
	const readOnly = claimedByOther || !canReview;
	const canManageVm = !closed || canEditHeld;
	const vmEnabled = meta.allowVms && vmConfigured();
	const skipsHold = program.secondPassOrganizerBypass && operatesProgram;
	const holds = (kindHeld: boolean) => program.secondPass && kindHeld && !skipsHold;

	const reviewerVm: ReviewVm | null = vmRow
		? {
				vmid: vmRow.vmid,
				type: vmRow.vmType,
				name: vmRow.name,
				guacUrl: vmRow.guacUrl,
				rdpUri: vmRow.rdpUri,
				rdpPassword: decryptOrNull(vmRow.rdpPasswordEnc),
				ago: ago(vmRow.createdAt)
			}
		: null;

	return {
		ship: shipSummary(ship, people, meta.color),
		collaborators: people.collaborators.length
			? people.collaborators.map((person) => {
					const found = excluded.find((entry) => entry.makerId === person.makerId);
					return {
						...person,
						excluded: found
							? {
									seconds: captured.collaborators[person.makerId]?.total ?? 0,
									reason: found.reason
								}
							: null
					};
				})
			: null,
		makers: people.makers,
		authors: people.authors,
		hackatimeProjects: shipProjects(ship),
		fileHours,
		pastProjects,
		evidence: shipEvidence(ship, people),
		hours: shipHours(ship),
		settlementEvidence: withoutPeople(
			evidence,
			excluded.map((person) => person.makerId)
		),
		rules: { hoursJustification: meta.hoursJustification, allowDeflation: meta.allowDeflation },
		update: ship.isUpdate ? { message: ship.updateMessage ?? '' } : null,
		warnings: warningRows(warnings),
		// unawaited on purpose so it streams after first paint. a passive onlooker and a closed
		// ship must not trigger the checks
		liveChecks:
			privateProvider.enabled && claimable && !claimedByOther && canReview
				? runLiveChecks(shipRef, viewer)
				: null,
		snapshot: {
			version: ship.enrichmentVersion,
			synced: Boolean(ship.evidenceSyncedAt),
			syncedAgo: ship.evidenceSyncedAt ? ago(ship.evidenceSyncedAt) : null,
			issue
		},
		checklist: checklist
			.filter((item) => item.tracks.includes(ship.track))
			.map((item) => ({ label: item.label })),
		fixes: fixTargets(reviews, ship, canViewReviewed),
		snippets,
		customFields: customFields
			.filter((field) => field.tracks.includes(ship.track))
			.map((field) => ({
				id: field.id,
				type: field.type as RuleFieldType,
				label: field.label,
				description: field.description,
				key: field.key,
				options: field.options,
				required: field.required
			})),
		pastReviews: pastReviewRows(reviews, ship, canViewReviewed, people.nameByMakerId),
		draft: draft ? draftFromRow(draft) : null,
		recorded,
		lock: {
			claimable,
			mine: ship.claimedById === user.id,
			readOnly,
			byName: claimedByOther ? (ship.claimedBy?.name ?? null) : null
		},
		viewer: { canReview, canSecondPass, canOverride, canUseVms, canViewReviewed, operatesProgram },
		state: {
			decided,
			closed,
			secondPass,
			heldByViewer,
			canEditHeld,
			canRevert: canOverride && decided,
			canManageVm,
			canLaunchVm: vmEnabled && canUseVms && canManageVm && !readOnly && ship.track === 'software',
			holds: {
				approved: holds(program.secondPassApproved),
				changes: holds(program.secondPassChanges),
				rejected: holds(program.secondPassRejected)
			}
		},
		reviewGoal: { weekCount, goal: meta.reviewGoal },
		nav,
		vmEnabled,
		vm: reviewerVm,
		privatePanels
	};
}
