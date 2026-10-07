import { error, redirect } from '@sveltejs/kit';
import { allPermissions, orgViewProgramPermissions } from '$lib/data';
import type { OrgPermission, Prisma, ProgramPermission, SubmissionStatus, Track } from '$db';

type MakerIdentity = { email: string; slackId: string | null };

const membershipFor = (user: App.SessionUser, programId: string) =>
	user.memberships.find((membership) => membership.programId === programId);

export function requireUser(locals: App.Locals): App.SessionUser {
	if (!locals.user) throw redirect(303, '/login');
	return locals.user;
}

export function hasOrgPermission(user: App.SessionUser, permission: OrgPermission): boolean {
	if (user.orgPermissions.includes(permission)) return true;
	if (permission === 'VIEW_ALL_PROGRAMS') {
		return user.orgPermissions.includes('OPERATE_ALL_PROGRAMS');
	}
	if (permission === 'CREATE_PROGRAMS') return user.orgPermissions.includes('MANAGE_PROGRAMS');
	return false;
}

export function requireOrgPermission(
	locals: App.Locals,
	permission: OrgPermission
): App.SessionUser {
	const user = requireUser(locals);
	if (!hasOrgPermission(user, permission)) {
		throw error(403, 'You do not have permission to do this');
	}
	return user;
}

export function isPoc(user: App.SessionUser, programId: string): boolean {
	return membershipFor(user, programId)?.isPoc === true;
}

export function isAnyPoc(user: App.SessionUser): boolean {
	return (
		hasOrgPermission(user, 'OPERATE_ALL_PROGRAMS') ||
		user.memberships.some((membership) => membership.isPoc)
	);
}

export function hasPermission(
	user: App.SessionUser,
	programId: string,
	permission: ProgramPermission
): boolean {
	if (hasOrgPermission(user, 'OPERATE_ALL_PROGRAMS')) return true;
	if (
		hasOrgPermission(user, 'VIEW_ALL_PROGRAMS') &&
		orgViewProgramPermissions.includes(permission)
	) {
		return true;
	}
	const membership = membershipFor(user, programId);
	if (!membership) return false;
	return membership.isPoc || membership.permissions.includes(permission);
}

// the "operates the program" tier: a single granular permission is not enough, and the
// org view tier never qualifies
export function hasAllPermissions(user: App.SessionUser, programId: string): boolean {
	if (hasOrgPermission(user, 'OPERATE_ALL_PROGRAMS')) return true;
	const membership = membershipFor(user, programId);
	if (!membership) return false;
	return (
		membership.isPoc ||
		allPermissions.every((permission) => membership.permissions.includes(permission))
	);
}

export function effectiveProgramPermissions(
	user: App.SessionUser,
	programId: string
): ProgramPermission[] {
	return allPermissions.filter((permission) => hasPermission(user, programId, permission));
}

export function requirePermission(
	user: App.SessionUser,
	programId: string,
	permission: ProgramPermission
): void {
	if (!hasPermission(user, programId, permission)) {
		throw error(403, 'You do not have permission to do this');
	}
}

export function canAccessProgram(user: App.SessionUser, programId: string): boolean {
	return Boolean(membershipFor(user, programId)) || hasOrgPermission(user, 'VIEW_ALL_PROGRAMS');
}

// the org view tier is excluded on purpose: it can look but never claim, draft or decide
export function canReviewProgram(user: App.SessionUser, programId: string): boolean {
	return Boolean(membershipFor(user, programId)) || hasOrgPermission(user, 'OPERATE_ALL_PROGRAMS');
}

export function operatesAnyProgram(user: App.SessionUser): boolean {
	return (
		hasOrgPermission(user, 'VIEW_ALL_PROGRAMS') ||
		user.memberships.some((membership) => membership.isPoc || membership.permissions.length > 0)
	);
}

export function requireAnyProgramOperator(locals: App.Locals): App.SessionUser {
	const user = requireUser(locals);
	if (!operatesAnyProgram(user)) throw error(403, 'Organizers only');
	return user;
}

// null means every track. a regular member is scoped to their tracks whatever they hold
export function trackScope(user: App.SessionUser, programId: string): Track[] | null {
	if (hasOrgPermission(user, 'VIEW_ALL_PROGRAMS')) return null;
	const membership = membershipFor(user, programId);
	if (!membership) return null;
	return membership.isPoc ? null : membership.tracks;
}

export function trackWhere(scope: Track[] | null): { track?: { in: Track[] } } {
	return scope ? { track: { in: scope } } : {};
}

export function trackAllowed(scope: Track[] | null, track: Track): boolean {
	return scope === null || scope.includes(track);
}

export function selfReviewWhere(
	user: App.SessionUser,
	enabled: boolean,
	programId: string
): Prisma.SubmissionWhereInput {
	if (!enabled || hasAllPermissions(user, programId)) return {};
	const ownShips: Prisma.SubmissionWhereInput[] = [
		{ maker: { email: { equals: user.email, mode: 'insensitive' } } },
		{ collaborators: { some: { maker: { email: { equals: user.email, mode: 'insensitive' } } } } }
	];
	if (user.slackId) {
		ownShips.push({ maker: { slackId: user.slackId } });
		ownShips.push({ collaborators: { some: { maker: { slackId: user.slackId } } } });
	}
	return { NOT: { OR: ownShips } };
}

// held and fraud-review ships are hidden because the review screen would refuse them
export function visibleShipWhere(
	user: App.SessionUser,
	programId: string,
	excludeOwnProjects: boolean
): Prisma.SubmissionWhereInput {
	const hiddenStatuses: SubmissionStatus[] = [];
	if (!hasPermission(user, programId, 'SECOND_PASS')) hiddenStatuses.push('secondpass');
	if (!hasPermission(user, programId, 'VIEW_FRAUD')) hiddenStatuses.push('fraudreview');
	return {
		programId,
		...trackWhere(trackScope(user, programId)),
		...(hiddenStatuses.length ? { status: { notIn: hiddenStatuses } } : {}),
		...selfReviewWhere(user, excludeOwnProjects, programId)
	};
}

// caller checks the program setting first. must stay in step with selfReviewWhere so a
// direct url cannot reach a ship the queue hides
export function isSelfReview(
	user: App.SessionUser,
	submission: { maker: MakerIdentity; collaborators: { maker: MakerIdentity }[] },
	programId: string
): boolean {
	if (hasAllPermissions(user, programId)) return false;
	const email = user.email.toLowerCase();
	const slackId = user.slackId;
	const isViewer = (maker: MakerIdentity) =>
		maker.email.toLowerCase() === email || (Boolean(slackId) && maker.slackId === slackId);
	return (
		isViewer(submission.maker) ||
		submission.collaborators.some((collaborator) => isViewer(collaborator.maker))
	);
}
