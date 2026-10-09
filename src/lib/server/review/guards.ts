import { error, fail } from '@sveltejs/kit';
import type { Track } from '$db';
import type { Viewer } from '$lib/privateApi';
import type { ReviewProblem } from '$lib/review/reviewRules';
import type { ActionFailure, ActionOutcome, FailureCode } from '$lib/review/reviewTypes';
import {
	canAccessProgram,
	canReviewProgram,
	effectiveProgramPermissions,
	isSelfReview,
	requirePermission,
	trackAllowed,
	trackScope
} from '$lib/server/authz';
import { db } from '$lib/server/db';
import { hasFreshReauth, programReauthConfig, reauthLoginUrl } from '$lib/server/reauth';

export const decidedStatuses = ['approved', 'changes', 'rejected'];
// a held ship is only confirmed or returned, a parked one only moves when its verdict lands
export const closedStatuses = [
	...decidedStatuses,
	'reverted',
	'withdrawn',
	'secondpass',
	'fraudreview'
];

// form actions and endpoints skip the layout load, so its membership gate is repeated here.
// tighter than the layout: the org view tier reaches the page but never mutates
export function assertAccess(user: App.SessionUser, programId: string): void {
	if (!canReviewProgram(user, programId)) throw error(403, "You don't have access to this program");
}

export function assertTrack(user: App.SessionUser, programId: string, track: Track): void {
	if (!trackAllowed(trackScope(user, programId), track))
		throw error(403, 'This ship is outside your review track');
}

export const done = <Data>(data: Data): ActionOutcome<Data> => ({ ok: true, data });

export const refuse = (
	status: number,
	code: FailureCode,
	message: string,
	extra: Partial<ActionFailure> = {}
): { ok: false; status: number; failure: ActionFailure } => ({
	ok: false,
	status,
	failure: { error: message, code, ...extra }
});

const conflictCodes = ['claimHeldByOther', 'shipClosed', 'notAwaitingSecondPass'];
const forbiddenCodes = ['secondPassPermission', 'overridePermission', 'ownHeldDecision'];

export function refuseProblems(problems: ReviewProblem[]) {
	const first = problems[0];
	const status = conflictCodes.includes(first.code)
		? 409
		: forbiddenCodes.includes(first.code)
			? 403
			: 400;
	return refuse(status, first.code, first.message, {
		problems,
		...(first.code === 'claimHeldByOther' ? { locked: true as const } : {})
	});
}

export const selfReviewRefusal = () =>
	refuse(403, 'selfReview', 'You cannot review your own project.');

export const lockedRefusal = () =>
	refuse(409, 'claimHeldByOther', 'Another reviewer is reviewing this ship.', { locked: true });

export const toActionResult = <Data>(outcome: ActionOutcome<Data>) =>
	outcome.ok ? outcome.data : fail(outcome.status, outcome.failure);

export const viewerOf = (user: App.SessionUser, programId: string): Viewer => ({
	userId: user.id,
	permissions: effectiveProgramPermissions(user, programId)
});

export async function shipVmIds(submissionId: string): Promise<number[]> {
	const rows = await db.reviewerVm.findMany({ where: { submissionId }, select: { vmid: true } });
	return rows.map((row) => row.vmid);
}

export async function reauthRefusal(
	user: App.SessionUser,
	programId: string,
	submissionId: string
) {
	const reauth = await programReauthConfig(programId);
	if (!reauth.required) return { required: false, refusal: null };
	if (await hasFreshReauth(user.id, programId, reauth.ttlMs)) {
		return { required: true, refusal: null };
	}
	return {
		required: true,
		refusal: refuse(401, 'reauthRequired', 'Re-verify your identity to start reviewing.', {
			reauth: true,
			url: reauthLoginUrl(programId, `/p/${programId}/review/${submissionId}`)
		})
	};
}

type MakerIdentity = { email: string; slackId: string | null };

// the read gate of the page load, repeated by every endpoint that serves ship data
export async function assertCanView(
	user: App.SessionUser | null,
	programId: string,
	submissionId: string
): Promise<void> {
	if (!user) throw error(401, 'Sign in first');
	if (!canAccessProgram(user, programId)) throw error(403, "You don't have access to this program");
	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId },
		select: {
			track: true,
			status: true,
			program: { select: { reviewersCannotReviewOwnProjects: true } },
			maker: { select: { email: true, slackId: true } },
			collaborators: { select: { maker: { select: { email: true, slackId: true } } } }
		}
	});
	if (!ship) throw error(404, 'Submission not found');
	assertViewable(user, programId, ship, ship.program.reviewersCannotReviewOwnProjects);
}

// the write gate: the page's read gate on top of the review tier, for an action that skips
// the load. the ship is re-read by the caller for whatever else it needs
export async function assertCanAct(
	user: App.SessionUser,
	programId: string,
	submissionId: string
): Promise<{ track: Track; status: string }> {
	assertAccess(user, programId);
	const ship = await db.submission.findFirst({
		where: { id: submissionId, programId },
		select: {
			track: true,
			status: true,
			program: { select: { reviewersCannotReviewOwnProjects: true } },
			maker: { select: { email: true, slackId: true } },
			collaborators: { select: { maker: { select: { email: true, slackId: true } } } }
		}
	});
	if (!ship) throw error(404, 'Submission not found');
	assertViewable(user, programId, ship, ship.program.reviewersCannotReviewOwnProjects);
	return { track: ship.track, status: ship.status };
}

export function assertViewable(
	user: App.SessionUser,
	programId: string,
	ship: {
		track: Track;
		status: string;
		maker: MakerIdentity;
		collaborators: { maker: MakerIdentity }[];
	},
	excludeOwnProjects: boolean
): void {
	assertTrack(user, programId, ship.track);
	if (excludeOwnProjects && isSelfReview(user, ship, programId))
		throw error(403, 'You cannot review your own project');
	// a held ship shows the recorded decision, a parked one that it is parked
	if (ship.status === 'secondpass') requirePermission(user, programId, 'SECOND_PASS');
	if (ship.status === 'fraudreview') requirePermission(user, programId, 'VIEW_FRAUD');
}
