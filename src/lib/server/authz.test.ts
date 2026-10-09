import { describe, expect, test } from 'bun:test';
import { allPermissions, orgViewProgramPermissions } from '$lib/data';
import type { OrgPermission, ProgramPermission, Track } from '$db';
import {
	canAccessProgram,
	canReviewProgram,
	effectiveProgramPermissions,
	hasAllPermissions,
	hasOrgPermission,
	hasPermission,
	isAnyPoc,
	isPoc,
	isSelfReview,
	operatesAnyProgram,
	requireAnyProgramOperator,
	requireOrgPermission,
	requirePermission,
	requireUser,
	selfReviewWhere,
	trackAllowed,
	trackScope,
	trackWhere
} from './authz';

type Membership = App.SessionUser['memberships'][number];

const membership = (overrides: Partial<Membership> = {}): Membership => ({
	programId: 'programOne',
	permissions: [],
	isPoc: false,
	tracks: ['software'],
	...overrides
});

const userWith = (
	orgPermissions: OrgPermission[] = [],
	memberships: Membership[] = [],
	identity: { email?: string; slackId?: string | null } = {}
): App.SessionUser => ({
	id: 'userOne',
	email: identity.email ?? 'reviewer@example.com',
	name: 'Reviewer',
	namePending: false,
	avatarColor: '#338eda',
	slackId: identity.slackId ?? null,
	orgPermissions,
	memberships
});

const localsFor = (user: App.SessionUser | null): App.Locals => ({ user, sessionId: null });

const thrownBy = (action: () => unknown): { status?: number; location?: string } => {
	try {
		action();
	} catch (caught) {
		return caught as { status?: number; location?: string };
	}
	throw new Error('expected a throw');
};

const plainMember = userWith([], [membership()]);
const pocMember = userWith([], [membership({ isPoc: true })]);
const orgOperator = userWith(['OPERATE_ALL_PROGRAMS']);
const orgViewer = userWith(['VIEW_ALL_PROGRAMS']);
const stranger = userWith();

const writePermissions = allPermissions.filter(
	(permission) => !orgViewProgramPermissions.includes(permission)
);

describe('hasOrgPermission', () => {
	test('a held permission is granted, an unheld one is not', () => {
		expect(hasOrgPermission(userWith(['MANAGE_PEOPLE']), 'MANAGE_PEOPLE')).toBe(true);
		expect(hasOrgPermission(userWith(['MANAGE_PEOPLE']), 'MANAGE_MCP')).toBe(false);
		expect(hasOrgPermission(stranger, 'VIEW_ALL_PROGRAMS')).toBe(false);
	});

	test('operate implies view, never the reverse', () => {
		expect(hasOrgPermission(orgOperator, 'VIEW_ALL_PROGRAMS')).toBe(true);
		expect(hasOrgPermission(orgViewer, 'OPERATE_ALL_PROGRAMS')).toBe(false);
	});

	test('manage programs implies create, never the reverse', () => {
		expect(hasOrgPermission(userWith(['MANAGE_PROGRAMS']), 'CREATE_PROGRAMS')).toBe(true);
		expect(hasOrgPermission(userWith(['CREATE_PROGRAMS']), 'MANAGE_PROGRAMS')).toBe(false);
	});

	test('the broad tiers imply nothing else', () => {
		expect(hasOrgPermission(orgOperator, 'MANAGE_PROGRAMS')).toBe(false);
		expect(hasOrgPermission(orgOperator, 'GRANT_ORG_PERMS')).toBe(false);
		expect(hasOrgPermission(userWith(['MANAGE_PROGRAMS']), 'VIEW_ALL_PROGRAMS')).toBe(false);
	});
});

describe('hasPermission', () => {
	test('a plain member holds only what the membership grants', () => {
		const granted = userWith([], [membership({ permissions: ['SECOND_PASS'] })]);
		expect(hasPermission(granted, 'programOne', 'SECOND_PASS')).toBe(true);
		expect(hasPermission(granted, 'programOne', 'MANAGE_SETTINGS')).toBe(false);
		for (const permission of allPermissions) {
			expect(hasPermission(plainMember, 'programOne', permission)).toBe(false);
		}
	});

	test('a grant in one program does not leak into another', () => {
		const granted = userWith([], [membership({ permissions: ['MANAGE_REVIEWERS'] })]);
		expect(hasPermission(granted, 'programTwo', 'MANAGE_REVIEWERS')).toBe(false);
		expect(hasPermission(pocMember, 'programTwo', 'VIEW_REVIEWED')).toBe(false);
	});

	test('the poc and an org operator hold every permission', () => {
		for (const permission of allPermissions) {
			expect(hasPermission(pocMember, 'programOne', permission)).toBe(true);
			expect(hasPermission(orgOperator, 'anyProgram', permission)).toBe(true);
		}
	});

	test('view all programs grants exactly the read-only slice, everywhere', () => {
		for (const permission of orgViewProgramPermissions) {
			expect(hasPermission(orgViewer, 'anyProgram', permission)).toBe(true);
		}
		expect(writePermissions.length).toBeGreaterThan(0);
		for (const permission of writePermissions) {
			expect(hasPermission(orgViewer, 'anyProgram', permission)).toBe(false);
		}
	});

	test('an org viewer who is also a member keeps their membership grants', () => {
		const viewerMember = userWith(
			['VIEW_ALL_PROGRAMS'],
			[membership({ permissions: ['OVERRIDE_DECISIONS'] })]
		);
		expect(hasPermission(viewerMember, 'programOne', 'OVERRIDE_DECISIONS')).toBe(true);
		expect(hasPermission(viewerMember, 'programTwo', 'OVERRIDE_DECISIONS')).toBe(false);
	});
});

describe('effectiveProgramPermissions', () => {
	test('folds the org tiers and the poc seat into one list per program', () => {
		expect(effectiveProgramPermissions(plainMember, 'programOne')).toEqual([]);
		const granted = userWith([], [membership({ permissions: ['SECOND_PASS', 'USE_VMS'] })]);
		expect(effectiveProgramPermissions(granted, 'programOne')).toEqual(['SECOND_PASS', 'USE_VMS']);
		expect(effectiveProgramPermissions(granted, 'programTwo')).toEqual([]);
		expect(effectiveProgramPermissions(pocMember, 'programOne')).toEqual(allPermissions);
		expect(effectiveProgramPermissions(orgOperator, 'anyProgram')).toEqual(allPermissions);
		expect(effectiveProgramPermissions(orgViewer, 'anyProgram')).toEqual(
			allPermissions.filter((permission) => orgViewProgramPermissions.includes(permission))
		);
	});
});

describe('hasAllPermissions', () => {
	test('operator, poc and a fully granted member qualify', () => {
		const fullMember = userWith([], [membership({ permissions: [...allPermissions] })]);
		expect(hasAllPermissions(orgOperator, 'anyProgram')).toBe(true);
		expect(hasAllPermissions(pocMember, 'programOne')).toBe(true);
		expect(hasAllPermissions(fullMember, 'programOne')).toBe(true);
	});

	test('one missing permission, a viewer, or another program do not', () => {
		const almostFull = userWith(
			[],
			[membership({ permissions: allPermissions.slice(1) as ProgramPermission[] })]
		);
		expect(hasAllPermissions(almostFull, 'programOne')).toBe(false);
		expect(hasAllPermissions(orgViewer, 'programOne')).toBe(false);
		expect(hasAllPermissions(pocMember, 'programTwo')).toBe(false);
		expect(hasAllPermissions(stranger, 'programOne')).toBe(false);
	});
});

describe('poc helpers', () => {
	test('isPoc is per program', () => {
		expect(isPoc(pocMember, 'programOne')).toBe(true);
		expect(isPoc(pocMember, 'programTwo')).toBe(false);
		expect(isPoc(plainMember, 'programOne')).toBe(false);
		expect(isPoc(orgOperator, 'programOne')).toBe(false);
	});

	test('isAnyPoc counts any poc seat and org operators, not viewers', () => {
		expect(isAnyPoc(pocMember)).toBe(true);
		expect(isAnyPoc(orgOperator)).toBe(true);
		expect(isAnyPoc(orgViewer)).toBe(false);
		expect(isAnyPoc(plainMember)).toBe(false);
	});
});

describe('program access', () => {
	test('members and org viewers can access, strangers cannot', () => {
		expect(canAccessProgram(plainMember, 'programOne')).toBe(true);
		expect(canAccessProgram(plainMember, 'programTwo')).toBe(false);
		expect(canAccessProgram(orgViewer, 'programTwo')).toBe(true);
		expect(canAccessProgram(orgOperator, 'programTwo')).toBe(true);
		expect(canAccessProgram(stranger, 'programOne')).toBe(false);
	});

	test('an org viewer can look but never review', () => {
		expect(canReviewProgram(orgViewer, 'programOne')).toBe(false);
		expect(canReviewProgram(orgOperator, 'programOne')).toBe(true);
		expect(canReviewProgram(plainMember, 'programOne')).toBe(true);
		expect(canReviewProgram(plainMember, 'programTwo')).toBe(false);
	});

	test('operatesAnyProgram needs a poc seat, a granted permission or the org view tier', () => {
		expect(operatesAnyProgram(plainMember)).toBe(false);
		expect(operatesAnyProgram(pocMember)).toBe(true);
		expect(operatesAnyProgram(userWith([], [membership({ permissions: ['USE_VMS'] })]))).toBe(true);
		expect(operatesAnyProgram(orgViewer)).toBe(true);
		expect(operatesAnyProgram(orgOperator)).toBe(true);
		expect(operatesAnyProgram(userWith(['MANAGE_PEOPLE']))).toBe(false);
	});
});

describe('track scope', () => {
	const hardwareOnly = userWith([], [membership({ tracks: ['hardware'] })]);

	test('a regular member is scoped to their tracks, whatever permissions they hold', () => {
		expect(trackScope(hardwareOnly, 'programOne')).toEqual(['hardware']);
		const fullMember = userWith(
			[],
			[membership({ tracks: ['hardware'], permissions: [...allPermissions] })]
		);
		expect(trackScope(fullMember, 'programOne')).toEqual(['hardware']);
	});

	test('the poc, org viewers, operators and non-members are unscoped', () => {
		expect(trackScope(pocMember, 'programOne')).toBeNull();
		expect(trackScope(orgViewer, 'programOne')).toBeNull();
		expect(trackScope(orgOperator, 'programOne')).toBeNull();
		expect(trackScope(hardwareOnly, 'programTwo')).toBeNull();
		const viewerMember = userWith(['VIEW_ALL_PROGRAMS'], [membership({ tracks: ['hardware'] })]);
		expect(trackScope(viewerMember, 'programOne')).toBeNull();
	});

	test('trackWhere and trackAllowed agree', () => {
		expect(trackWhere(null)).toEqual({});
		expect(trackWhere(['hardware'])).toEqual({ track: { in: ['hardware'] } });
		expect(trackAllowed(null, 'software')).toBe(true);
		expect(trackAllowed(['hardware'], 'hardware')).toBe(true);
		expect(trackAllowed(['hardware'], 'software')).toBe(false);
		const noTracks: Track[] = [];
		expect(trackAllowed(noTracks, 'software')).toBe(false);
	});
});

describe('self review', () => {
	const maker = (email: string, slackId: string | null = null) => ({ email, slackId });
	const shipBy = (
		soloMaker: { email: string; slackId: string | null },
		collaborators: { email: string; slackId: string | null }[] = []
	) => ({
		maker: soloMaker,
		collaborators: collaborators.map((collaborator) => ({ maker: collaborator }))
	});
	const reviewer = userWith([], [membership()], {
		email: 'Reviewer@Example.com',
		slackId: 'slackReviewer'
	});

	test('matches the solo maker by email, ignoring case', () => {
		expect(isSelfReview(reviewer, shipBy(maker('reviewer@example.COM')), 'programOne')).toBe(true);
		expect(isSelfReview(reviewer, shipBy(maker('other@example.com')), 'programOne')).toBe(false);
	});

	test('matches by slack id, and as a collaborator', () => {
		expect(
			isSelfReview(reviewer, shipBy(maker('alt@example.com', 'slackReviewer')), 'programOne')
		).toBe(true);
		expect(
			isSelfReview(
				reviewer,
				shipBy(maker('other@example.com'), [maker('reviewer@example.com')]),
				'programOne'
			)
		).toBe(true);
		expect(
			isSelfReview(
				reviewer,
				shipBy(maker('other@example.com'), [maker('third@example.com', 'slackReviewer')]),
				'programOne'
			)
		).toBe(true);
	});

	test('a reviewer with no slack id never matches a maker with no slack id', () => {
		expect(isSelfReview(plainMember, shipBy(maker('other@example.com', null)), 'programOne')).toBe(
			false
		);
	});

	test('whoever operates the program is exempt, a granular permission is not enough', () => {
		const ownShip = shipBy(maker('reviewer@example.com'));
		expect(isSelfReview(pocMember, ownShip, 'programOne')).toBe(false);
		expect(isSelfReview(orgOperator, ownShip, 'programOne')).toBe(false);
		const secondPasser = userWith([], [membership({ permissions: ['SECOND_PASS'] })]);
		expect(isSelfReview(secondPasser, ownShip, 'programOne')).toBe(true);
		expect(isSelfReview(orgViewer, ownShip, 'programOne')).toBe(true);
	});

	test('selfReviewWhere is empty when disabled or exempt', () => {
		expect(selfReviewWhere(reviewer, false, 'programOne')).toEqual({});
		expect(selfReviewWhere(pocMember, true, 'programOne')).toEqual({});
		expect(selfReviewWhere(orgOperator, true, 'programOne')).toEqual({});
	});

	test('selfReviewWhere hides own ships by email and, when known, slack id', () => {
		const byEmail = { email: { equals: 'reviewer@example.com', mode: 'insensitive' as const } };
		expect(selfReviewWhere(plainMember, true, 'programOne')).toEqual({
			NOT: {
				OR: [{ maker: byEmail }, { collaborators: { some: { maker: byEmail } } }]
			}
		});
		const withSlack = selfReviewWhere(reviewer, true, 'programOne') as {
			NOT: { OR: unknown[] };
		};
		expect(withSlack.NOT.OR).toHaveLength(4);
		expect(withSlack.NOT.OR).toContainEqual({ maker: { slackId: 'slackReviewer' } });
		expect(withSlack.NOT.OR).toContainEqual({
			collaborators: { some: { maker: { slackId: 'slackReviewer' } } }
		});
	});
});

describe('require helpers', () => {
	test('requireUser redirects to /login without a session', () => {
		const thrown = thrownBy(() => requireUser(localsFor(null)));
		expect(thrown.status).toBe(303);
		expect(thrown.location).toBe('/login');
		expect(requireUser(localsFor(plainMember))).toBe(plainMember);
	});

	test('requireOrgPermission: 303 signed out, 403 without it, user with it', () => {
		expect(thrownBy(() => requireOrgPermission(localsFor(null), 'MANAGE_MCP')).status).toBe(303);
		expect(thrownBy(() => requireOrgPermission(localsFor(plainMember), 'MANAGE_MCP')).status).toBe(
			403
		);
		expect(requireOrgPermission(localsFor(orgOperator), 'VIEW_ALL_PROGRAMS')).toBe(orgOperator);
	});

	test('requirePermission: 403 unless held', () => {
		expect(
			thrownBy(() => requirePermission(plainMember, 'programOne', 'MANAGE_SETTINGS')).status
		).toBe(403);
		expect(
			thrownBy(() => requirePermission(orgViewer, 'programOne', 'MANAGE_SETTINGS')).status
		).toBe(403);
		expect(() => requirePermission(pocMember, 'programOne', 'MANAGE_SETTINGS')).not.toThrow();
		expect(() => requirePermission(orgViewer, 'programOne', 'VIEW_AUDIT_LOG')).not.toThrow();
	});

	test('requireAnyProgramOperator: 303 signed out, 403 for a plain reviewer', () => {
		expect(thrownBy(() => requireAnyProgramOperator(localsFor(null))).status).toBe(303);
		expect(thrownBy(() => requireAnyProgramOperator(localsFor(plainMember))).status).toBe(403);
		expect(requireAnyProgramOperator(localsFor(pocMember))).toBe(pocMember);
	});
});
