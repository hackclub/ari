import { error, redirect } from '@sveltejs/kit';
import { privateProvider } from '$private';
import { db } from '$lib/server/db';
import { hasOrgPermission, trackScope, trackWhere } from '$lib/server/authz';
import { allPermissions, orgViewProgramPermissions, type ProgramPermission } from '$lib/data';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) throw redirect(303, '/login');

	// membership and org permissions come from the session, so the guards need no query
	const programId = params.program;
	const orgOperator = hasOrgPermission(user, 'OPERATE_ALL_PROGRAMS');
	const orgViewer = hasOrgPermission(user, 'VIEW_ALL_PROGRAMS');
	const membership = user.memberships.find((entry) => entry.programId === programId);
	const isPocHere = membership?.isPoc ?? false;
	const permissions: ProgramPermission[] =
		orgOperator || isPocHere
			? allPermissions
			: orgViewer
				? allPermissions.filter(
						(permission) =>
							orgViewProgramPermissions.includes(permission) ||
							membership?.permissions.includes(permission)
					)
				: (membership?.permissions ?? []);
	const canSecondPass = permissions.includes('SECOND_PASS');
	const memberProgramIds = user.memberships.map((entry) => entry.programId);

	const [program, secondPassPending, accessible] = await Promise.all([
		db.program.findUnique({ where: { id: programId } }),
		canSecondPass
			? db.submission.count({ where: { programId, status: 'secondpass' } })
			: Promise.resolve(0),
		// the switcher lists the viewer's own programs plus the one being viewed
		db.program.findMany({
			where: {
				id: { in: [...new Set([programId, ...memberProgramIds])] },
				OR: [{ id: programId }, { status: { not: 'ARCHIVED' } }]
			},
			select: { id: true, name: true, color: true, iconUrl: true, cardBgUrl: true },
			orderBy: { name: 'asc' }
		})
	]);

	if (!program) throw error(404, 'Program not found');
	if (!membership && !orgViewer) throw error(403, "You don't have access to this program");

	// a reviewer's track scope differs per program, so each program contributes its own disjunct
	const countedIds = [...new Set([programId, ...accessible.map((entry) => entry.id)])];
	const [pendingCounts, privateTabs] = await Promise.all([
		db.submission.groupBy({
			by: ['programId'],
			where: {
				status: { in: ['pending'] },
				OR: countedIds.map((id) => ({ programId: id, ...trackWhere(trackScope(user, id)) }))
			},
			_count: { _all: true }
		}),
		privateProvider.programNavTabs(programId, { userId: user.id, permissions })
	]);
	const pendingByProgram = new Map(pendingCounts.map((row) => [row.programId, row._count._all]));

	return {
		program: program.name,
		programId: program.id,
		permissions,
		isPoc: isPocHere,
		orgWide: orgViewer,
		meta: {
			color: program.color,
			iconUrl: program.iconUrl,
			cardBgUrl: program.cardBgUrl,
			accepts: program.accepts,
			locked: program.status !== 'ACTIVE',
			allowVms: program.allowVms,
			secondPass: program.secondPass,
			secondPassOrganizerBypass: program.secondPassOrganizerBypass,
			excludeOwnProjects: program.reviewersCannotReviewOwnProjects,
			allowDeflation: program.allowDeflation,
			hoursJustification: program.hoursJustification,
			reauthRequired: program.reviewerReauth,
			reauthTtlMinutes: program.reviewerReauthTtlMinutes,
			reviewGoal: program.weeklyReviewGoal
		},
		pending: pendingByProgram.get(programId) ?? 0,
		secondPassPending,
		privateTabs,
		assignedPrograms: accessible.map((entry) => ({
			name: entry.name,
			id: entry.id,
			color: entry.color,
			iconUrl: entry.iconUrl,
			cardBgUrl: entry.cardBgUrl,
			pending: pendingByProgram.get(entry.id) ?? 0
		}))
	};
};
