import { privateProvider } from '$private';
import { db } from '$lib/server/db';
import { makerDisplaySelect, reviewedRow } from '$lib/server/serialize';
import { requirePermission, selfReviewWhere } from '$lib/server/authz';
import { storedApprovedSeconds } from '$lib/server/settlementStore';
import { pageParam, pageSlice, trackParam } from '$lib/shipList';
import { minutesToSeconds } from '$lib/time';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { programId, meta } = await parent();
	// never track-scoped: second-pass reviewers see every track
	requirePermission(locals.user!, programId, 'SECOND_PASS');

	const held = await db.submission.findMany({
		// the list previews the held decision, so the viewer's own ships stay out of it too
		where: {
			programId,
			status: 'secondpass',
			...selfReviewWhere(locals.user!, meta.excludeOwnProjects, programId)
		},
		select: {
			id: true,
			title: true,
			status: true,
			track: true,
			receivedAt: true,
			thumbnailUrl: true,
			authorNameOverrides: true,
			priority: true,
			maker: { select: makerDisplaySelect },
			hours: true,
			collaborators: {
				select: { makerId: true, maker: { select: makerDisplaySelect } },
				orderBy: { id: 'asc' }
			},
			reviews: {
				select: {
					approvedMinutes: true,
					approvedSeconds: true,
					settlementVersion: true,
					createdAt: true,
					decision: true,
					noteToMaker: true,
					auditNote: true,
					deflateMinutes: true,
					deflateSeconds: true,
					reviewer: { select: { name: true, avatarColor: true, slackId: true } }
				},
				orderBy: { createdAt: 'desc' },
				take: 1
			}
		},
		orderBy: { receivedAt: 'asc' }
	});

	// priority first, then longest held: ordered by when the decision was parked, not when the
	// ship arrived. must match the review screen's prev/next order
	const heldAt = (ship: (typeof held)[number]) =>
		(ship.reviews[0]?.createdAt ?? ship.receivedAt).getTime();
	const ordered = [...held].sort((first, second) => {
		if (first.priority !== second.priority) return first.priority ? -1 : 1;
		return heldAt(first) - heldAt(second);
	});

	const track = trackParam(url);
	const filtered = track ? ordered.filter((ship) => ship.track === track) : ordered;
	const page = pageParam(url, filtered.length);

	const shown = pageSlice(filtered, page);
	// a fixed cut can land while the decision is held: the confirm settles with the live one
	const deductions = await Promise.all(
		shown.map((ship) => privateProvider.shipDeductions({ submissionId: ship.id, programId }))
	);

	return {
		rows: shown.map((ship, index) => {
			const row = reviewedRow(ship, meta.color);
			const review = ship.reviews[0];
			if (!review) return { ...row, priority: ship.priority, decision: 'approved' as const };
			// old ari writes minute-only reviews, whose seconds columns stay at their default
			const deflateSeconds =
				review.settlementVersion === 3
					? (review.deflateSeconds ?? 0)
					: minutesToSeconds(review.deflateMinutes ?? 0);
			return {
				...row,
				priority: ship.priority,
				// the net the maker will get, as the review screen shows it
				approvedSeconds: Math.max(
					0,
					storedApprovedSeconds(review) -
						deflateSeconds -
						Object.values(deductions[index]?.seconds ?? {}).reduce(
							(sum, seconds) => sum + seconds,
							0
						)
				),
				decision: review.decision
			};
		}),
		total: filtered.length,
		heldTotal: held.length,
		page,
		track,
		bothTracks:
			held.some((ship) => ship.track === 'software') &&
			held.some((ship) => ship.track === 'hardware')
	};
};
