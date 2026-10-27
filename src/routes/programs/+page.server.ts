import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { hasOrgPermission, trackScope, trackWhere } from '$lib/server/authz';
import { claimStaleBefore } from '$lib/server/claims';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) throw redirect(303, '/login');

	// org-wide viewers land on their own programs. the rest are an explicit opt-in (?all=1)
	const canViewAll = hasOrgPermission(user, 'VIEW_ALL_PROGRAMS');
	const showAll = canViewAll && url.searchParams.get('all') === '1';
	const programs = await db.program.findMany({
		where: {
			status: { not: 'ARCHIVED' },
			...(showAll ? {} : { id: { in: user.memberships.map((membership) => membership.programId) } })
		},
		orderBy: { name: 'asc' }
	});

	if (programs.length === 0) return { assigned: [], empty: true, canViewAll, showAll };

	// "start reviewing" must land on a ship this reviewer can open: same rule as claimSubmission
	const claimFree = {
		OR: [{ claimedById: null }, { claimedById: user.id }, { claimedAt: { lt: claimStaleBefore() } }]
	};

	// each program keeps its own track scope, so the scopes join as one disjunction
	const scopedPrograms = programs.map((program) => ({
		programId: program.id,
		...trackWhere(trackScope(user, program.id))
	}));
	const [pendingCounts, firstWaiting] = await Promise.all([
		db.submission.groupBy({
			by: ['programId'],
			where: { status: { in: ['pending'] }, OR: scopedPrograms },
			_count: { _all: true }
		}),
		// under this ordering distinct keeps the oldest queued ship per program
		db.submission.findMany({
			where: { status: { in: ['pending'] }, AND: [{ OR: scopedPrograms }, claimFree] },
			orderBy: [{ programId: 'asc' }, { queuedAt: 'asc' }],
			distinct: ['programId'],
			select: { id: true, programId: true }
		})
	]);
	const pendingByProgram = new Map(pendingCounts.map((row) => [row.programId, row._count._all]));
	const firstWaitingByProgram = new Map(firstWaiting.map((row) => [row.programId, row.id]));

	const memberProgramIds = new Set(user.memberships.map((membership) => membership.programId));
	const assigned = programs.map((program) => ({
		name: program.name,
		id: program.id,
		color: program.color,
		iconUrl: program.iconUrl,
		cardBgUrl: program.cardBgUrl,
		pending: pendingByProgram.get(program.id) ?? 0,
		firstWaitingId: firstWaitingByProgram.get(program.id) ?? null,
		// only false in the browse-all view: reached through an org permission, not a membership
		member: memberProgramIds.has(program.id)
	}));

	return { assigned, empty: false, canViewAll, showAll };
};
