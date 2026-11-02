import { db } from '$lib/server/db';
import { evidenceSeconds, makerDisplaySelect, submissionRow } from '$lib/server/serialize';
import { trackScope, trackWhere, selfReviewWhere } from '$lib/server/authz';
import { isClaimStale } from '$lib/server/claims';
import { pageParam, pageSlice, trackParam } from '$lib/shipList';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { programId, meta } = await parent();
	const userId = locals.user!.id;
	const scope = trackScope(locals.user!, programId);
	const ownFilter = selfReviewWhere(locals.user!, meta.excludeOwnProjects, programId);

	const submissions = await db.submission.findMany({
		where: { programId, status: 'pending', ...trackWhere(scope), ...ownFilter },
		select: {
			id: true,
			title: true,
			status: true,
			track: true,
			receivedAt: true,
			queuedAt: true,
			acceptedEvidence: true,
			thumbnailUrl: true,
			authorNameOverrides: true,
			priority: true,
			isUpdate: true,
			claimedAt: true,
			claimedById: true,
			maker: { select: makerDisplaySelect },
			hours: true,
			collaborators: {
				select: { makerId: true, maker: { select: makerDisplaySelect } },
				orderBy: { id: 'asc' }
			},
			claimedBy: { select: { id: true, name: true } }
		},
		orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }]
	});

	const track = trackParam(url);
	const sort = url.searchParams.get('sort') === 'hours' ? ('hours' as const) : ('oldest' as const);
	let filtered = track ? submissions.filter((ship) => ship.track === track) : submissions;
	// priority ships stay pinned first in every sort
	if (sort === 'hours')
		filtered = [...filtered].sort(
			(first, second) =>
				Number(second.priority) - Number(first.priority) ||
				evidenceSeconds(second.hours) - evidenceSeconds(first.hours)
		);

	// a stale claim is effectively free
	const liveClaim = (ship: (typeof submissions)[number]) =>
		ship.claimedBy !== null && !isClaimStale(ship.claimedAt);
	const startId =
		filtered.find((ship) => !liveClaim(ship) || ship.claimedById === userId)?.id ?? null;

	const page = pageParam(url, filtered.length);
	return {
		rows: pageSlice(filtered, page).map((ship) => ({
			...submissionRow(ship, meta.color),
			isUpdate: ship.isUpdate,
			claim: liveClaim(ship)
				? { mine: ship.claimedById === userId, byName: ship.claimedBy!.name }
				: null
		})),
		total: filtered.length,
		page,
		track,
		sort,
		startId,
		bothTracks:
			submissions.some((ship) => ship.track === 'software') &&
			submissions.some((ship) => ship.track === 'hardware')
	};
};
