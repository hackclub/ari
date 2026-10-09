import type { Prisma, ProgramPermission } from '$db';
import { db } from '$lib/server/db';
import {
	canAccessProgram,
	hasOrgPermission,
	hasPermission,
	visibleShipWhere
} from '$lib/server/authz';
import { assertViewable } from '$lib/server/review/guards';
import type { McpContext } from '../auth';
import { toolError, ToolRefusal } from './shared';

export const tokenReaches = (context: McpContext, programId: string): boolean =>
	context.programIds.length === 0 || context.programIds.includes(programId);

const reaches = (context: McpContext, programId: string, permission?: ProgramPermission) =>
	tokenReaches(context, programId) &&
	canAccessProgram(context.user, programId) &&
	(!permission || hasPermission(context.user, programId, permission));

// an unreachable program reads as a missing one, so a token cannot probe for ids
export async function programFor(
	context: McpContext,
	reference: unknown,
	permission?: ProgramPermission
) {
	const id = String(reference ?? '');
	const program = await db.program.findUnique({
		where: { id },
		select: { id: true, name: true, status: true, reviewersCannotReviewOwnProjects: true }
	});
	if (!program || !tokenReaches(context, program.id) || !canAccessProgram(context.user, program.id))
		throw new ToolRefusal(404, `No program matches "${id}" (try list_programs).`);
	if (permission && !hasPermission(context.user, program.id, permission))
		throw new ToolRefusal(403, `You need the ${permission} permission on this program.`);
	return program;
}

export async function reachablePrograms(context: McpContext, permission?: ProgramPermission) {
	const programs = await db.program.findMany({
		where: hasOrgPermission(context.user, 'VIEW_ALL_PROGRAMS')
			? {}
			: { id: { in: context.user.memberships.map((membership) => membership.programId) } },
		select: { id: true, reviewersCannotReviewOwnProjects: true }
	});
	return programs.filter((program) => reaches(context, program.id, permission));
}

// one disjunction of each program's own visibility rule; matches nothing when there are none
export function shipsWhere(
	context: McpContext,
	programs: { id: string; reviewersCannotReviewOwnProjects: boolean }[]
): Prisma.SubmissionWhereInput {
	return {
		OR: programs.length
			? programs.map((program) =>
					visibleShipWhere(context.user, program.id, program.reviewersCannotReviewOwnProjects)
				)
			: [{ id: { in: [] } }]
	};
}

// the same gate as the review screen for one ship
export async function viewableShip(context: McpContext, id: unknown) {
	const ship = await db.submission.findUnique({
		where: { id: String(id ?? '') },
		select: {
			id: true,
			programId: true,
			track: true,
			status: true,
			program: { select: { reviewersCannotReviewOwnProjects: true } },
			maker: { select: { email: true, slackId: true } },
			collaborators: { select: { maker: { select: { email: true, slackId: true } } } }
		}
	});
	if (
		!ship ||
		!tokenReaches(context, ship.programId) ||
		!canAccessProgram(context.user, ship.programId)
	)
		throw new ToolRefusal(404, `No submission with id "${String(id ?? '')}".`);
	try {
		assertViewable(
			context.user,
			ship.programId,
			ship,
			ship.program.reviewersCannotReviewOwnProjects
		);
	} catch (caught) {
		const { status, message } = toolError(caught);
		throw new ToolRefusal(status, message);
	}
	return ship;
}

export function requireOrgWide(context: McpContext): void {
	if (context.programIds.length) {
		throw new ToolRefusal(
			403,
			'This token is limited to some programs, so it cannot use org-wide tools.'
		);
	}
}

export function requireOrgPermission(
	context: McpContext,
	...anyOf: Parameters<typeof hasOrgPermission>[1][]
): void {
	requireOrgWide(context);
	if (!anyOf.some((permission) => hasOrgPermission(context.user, permission))) {
		throw new ToolRefusal(403, `You need the ${anyOf.join(' or ')} org permission.`);
	}
}
