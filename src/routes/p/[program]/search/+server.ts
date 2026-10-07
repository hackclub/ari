import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { canAccessProgram, hasPermission, visibleShipWhere } from '$lib/server/authz';
import { authorLabel, evidenceSeconds } from '$lib/server/serialize';
import { matchedDetail, searchShipCandidates } from '$lib/server/shipSearch';

export const GET: RequestHandler = async ({ url, params, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'unauthorized' }, { status: 401 });

	const query = (url.searchParams.get('q') ?? '').trim();
	if (!query) return json({ subs: [], people: [] });

	const program = await db.program.findUnique({
		where: { id: params.program ?? '' },
		select: { id: true, color: true, reviewersCannotReviewOwnProjects: true }
	});
	if (!program) return json({ error: 'not_found' }, { status: 404 });

	// the program layout gate does not run for an endpoint, so access is enforced here
	if (!canAccessProgram(user, program.id)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	const matches = { contains: query, mode: 'insensitive' as const };

	// member names and emails are the roster, so they take the roster's gate
	const canSeeReviewers = hasPermission(user, program.id, 'VIEW_REVIEWERS');
	const [candidates, memberships] = await Promise.all([
		searchShipCandidates(program.id, query),
		canSeeReviewers
			? db.membership.findMany({
					where: {
						programId: program.id,
						user: { OR: [{ name: matches }, { email: matches }] }
					},
					include: { user: true },
					take: 4 // a short people section under the ships in the dropdown
				})
			: []
	]);

	// the ranking knows nothing about access: the same rules as the queue decide what is listed
	const visible = await db.submission.findMany({
		where: {
			...visibleShipWhere(user, program.id, program.reviewersCannotReviewOwnProjects),
			id: { in: candidates.map((candidate) => candidate.id) }
		},
		include: {
			maker: true,
			hours: true,
			collaborators: { include: { maker: true }, orderBy: { id: 'asc' } }
		}
	});
	const byId = new Map(visible.map((submission) => [submission.id, submission]));
	const ranked = candidates.filter((candidate) => byId.has(candidate.id));
	// someone's email, name or id lists every ship of theirs. 50: a full dropdown, scrolled.
	// anything else is a lookup for one ship. 8: the best fits, readable at a glance
	const people = ranked.filter((candidate) => candidate.byPerson).slice(0, 50);
	// a ship that has the words as typed pushes out the ones that are only close to them
	const written = ranked.filter((candidate) => candidate.exact);
	const shown = people.length ? people : (written.length ? written : ranked).slice(0, 8);
	const submissions = shown.flatMap((candidate) => byId.get(candidate.id) ?? []);

	return json({
		subs: submissions.map((submission) => ({
			id: submission.id,
			title: submission.title,
			author: authorLabel(submission),
			detail: matchedDetail(query, {
				repoUrl: submission.repoUrl,
				demoUrl: submission.demoUrl,
				people: [submission.maker, ...submission.collaborators.map((entry) => entry.maker)]
			}),
			slackId: submission.collaborators.length ? null : submission.maker.slackId,
			color: program.color,
			evidenceSeconds: evidenceSeconds(submission.hours),
			href: `/p/${program.id}/review/${submission.id}`
		})),
		people: memberships.map((membership) => ({
			name: membership.user.name,
			email: membership.user.email,
			color: membership.user.avatarColor,
			slackId: membership.user.slackId,
			href: `/p/${program.id}/reviewers?focus=${encodeURIComponent(membership.user.email)}`
		}))
	});
};
