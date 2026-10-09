import type { Prisma } from '$db';
import type {
	ClipRow,
	CommitPerson,
	CommitRow,
	DevlogRow,
	ReviewCollaborator,
	ReviewMaker,
	ReviewShip,
	ShipStatus
} from '$lib/review/reviewTypes';
import { ago, commitAuthorLabel, joinNames, shipAuthorName } from '$lib/server/serialize';

export const shipInclude = {
	maker: true,
	collaborators: { include: { maker: true }, orderBy: { id: 'asc' } },
	hours: true,
	commits: { orderBy: { committedAt: 'desc' } },
	devlogs: { orderBy: { at: 'desc' } },
	clips: { orderBy: { at: 'desc' } },
	claimedBy: { select: { id: true, name: true, avatarColor: true, slackId: true } }
} satisfies Prisma.SubmissionInclude;

export type LoadedShip = Prisma.SubmissionGetPayload<{ include: typeof shipInclude }>;

const dateTime = (date: Date) =>
	date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
const dayLabel = (date: Date) =>
	date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function projectSeconds(raw: unknown): { name: string; seconds: number }[] {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
	return Object.entries(raw)
		.filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
		.map(([name, seconds]) => ({ name, seconds }))
		.sort((first, second) => second.seconds - first.seconds);
}

function uniqueByEmail<Person extends { email: string }>(people: Person[]): Person[] {
	const seen = new Set<string>();
	return people.filter((person) => {
		const email = person.email.toLowerCase();
		if (seen.has(email)) return false;
		seen.add(email);
		return true;
	});
}

export function shipPeople(ship: LoadedShip) {
	const collaborators: ReviewCollaborator[] = ship.collaborators.map((collaborator) => ({
		makerId: collaborator.makerId,
		name: shipAuthorName(ship, collaborator.maker),
		slackId: collaborator.maker.slackId,
		hackatimeUserId: collaborator.maker.hackatimeUserId,
		hackatimeSeconds: collaborator.hackatimeSeconds,
		devlogSeconds: collaborator.devlogSeconds,
		lapseSeconds: collaborator.lapseSeconds,
		afterLastCommitSeconds: collaborator.afterLastCommitSeconds,
		programSeconds: collaborator.programSeconds,
		projects: projectSeconds(collaborator.hackatimeProjectSeconds)
	}));
	const nameByMakerId = new Map(collaborators.map((person) => [person.makerId, person.name]));

	// a collaborative payload can repeat the primary maker
	const collaboratorMakers = ship.collaborators.map((collaborator) => collaborator.maker);
	const makers: ReviewMaker[] = uniqueByEmail([ship.maker, ...collaboratorMakers]).map((maker) => ({
		name: shipAuthorName(ship, maker),
		email: maker.email,
		slackId: maker.slackId,
		hackatimeUserId: maker.hackatimeUserId
	}));
	const authors = uniqueByEmail(collaboratorMakers.length ? collaboratorMakers : [ship.maker]).map(
		(maker) => ({ email: maker.email, name: shipAuthorName(ship, maker) })
	);

	const knownByEmail = new Map<string, { name: string; slackId: string | null }>();
	for (const maker of [ship.maker, ...collaboratorMakers]) {
		knownByEmail.set(maker.email.toLowerCase(), {
			name: shipAuthorName(ship, maker),
			slackId: maker.slackId
		});
	}
	return { collaborators, nameByMakerId, makers, authors, knownByEmail };
}

export type ShipPeople = ReturnType<typeof shipPeople>;

// informational only: a git email matching a submitter shows that person, otherwise the git name
function commitPeople(commit: LoadedShip['commits'][number], people: ShipPeople): CommitPerson[] {
	const responsible = [
		{ name: commit.authorName, email: commit.authorEmail },
		...((commit.coAuthors as { name: string | null; email: string | null }[]) ?? [])
	];
	const seen = new Set<string>();
	const listed: CommitPerson[] = [];
	for (const person of responsible) {
		const known = person.email ? people.knownByEmail.get(person.email.toLowerCase()) : undefined;
		const label =
			known?.name ?? commitAuthorLabel(person.name, person.email) ?? person.email ?? 'unknown';
		if (seen.has(label.toLowerCase())) continue;
		seen.add(label.toLowerCase());
		listed.push({ label, slackId: known?.slackId ?? null, matched: Boolean(known) });
	}
	return listed;
}

export function shipEvidence(ship: LoadedShip, people: ShipPeople) {
	const makerName = (makerId: string | null) =>
		makerId ? (people.nameByMakerId.get(makerId) ?? null) : null;
	const commits: CommitRow[] = ship.commits.map((commit) => ({
		id: commit.id,
		hash: commit.hash,
		message: commit.message,
		committedAt: commit.committedAt.toISOString(),
		when: dateTime(commit.committedAt),
		additions: commit.additions,
		deletions: commit.deletions,
		codingSeconds: commit.codingSeconds,
		htSeen: commit.htSeen,
		makerId: commit.makerId,
		people: commitPeople(commit, people)
	}));
	const clips: ClipRow[] = ship.clips.map((clip) => ({
		id: clip.id,
		at: clip.at.toISOString(),
		when: dayLabel(clip.at),
		lengthSeconds: clip.lengthSeconds,
		note: clip.note,
		url: clip.url,
		thumbnailUrl: clip.thumbnailUrl,
		makerId: clip.makerId,
		makerName: makerName(clip.makerId)
	}));
	const devlogs: DevlogRow[] = ship.devlogs.map((devlog) => ({
		id: devlog.id,
		at: devlog.at.toISOString(),
		when: dayLabel(devlog.at),
		seconds: devlog.seconds,
		text: devlog.text,
		hasImage: devlog.hasImage,
		markdown: devlog.markdown,
		makerId: devlog.makerId,
		makerName: makerName(devlog.makerId)
	}));
	return { commits, clips, devlogs };
}

type ProgramMeta = Record<string, string | string[]> | null;

// display only: the principal repoUrl is the one repository that is fetched and enriched
function extraRepoUrls(ship: LoadedShip): string[] {
	const raw = (ship.programMeta as ProgramMeta)?.git;
	const entries = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
	const normalize = (url: string) =>
		url
			.trim()
			.replace(/\.git$/i, '')
			.replace(/\/$/, '');
	const seen = new Set([normalize(ship.repoUrl).toLowerCase()]);
	const urls: string[] = [];
	for (const entry of entries) {
		if (typeof entry !== 'string' || !/^https?:\/\//i.test(entry.trim())) continue;
		const url = normalize(entry);
		if (seen.has(url.toLowerCase())) continue;
		seen.add(url.toLowerCase());
		urls.push(url);
	}
	return urls;
}

export function shipSummary(ship: LoadedShip, people: ShipPeople, color: string): ReviewShip {
	const collaborative = people.collaborators.length > 0;
	return {
		id: ship.id,
		projectId: ship.externalId,
		title: ship.title,
		description: ship.description,
		reviewerNote: ship.reviewerNote ?? '',
		author: collaborative
			? joinNames(people.collaborators.map((person) => person.name))
			: shipAuthorName(ship, ship.maker),
		authorSlackId: collaborative ? null : ship.maker.slackId,
		status: ship.status as ShipStatus,
		ingestVersion: ship.ingestVersion,
		version: ship.version,
		track: ship.track,
		repoUrl: ship.repoUrl,
		extraRepoUrls: extraRepoUrls(ship),
		demoUrl: ship.demoUrl,
		thumbnailUrl: ship.thumbnailUrl,
		// underscore keys are internal control values and git renders as extraRepoUrls
		meta: ship.programMeta
			? Object.fromEntries(
					Object.entries(ship.programMeta as Record<string, string | string[]>).filter(
						([key]) => !key.startsWith('_') && key !== 'git'
					)
				)
			: null,
		color,
		receivedAt: ship.receivedAt.toISOString(),
		ago: ago(ship.receivedAt),
		priority: ship.priority
	};
}

export function shipHours(ship: LoadedShip) {
	return {
		hackatimeSeconds: ship.hours?.hackatimeSeconds ?? 0,
		devlogSeconds: ship.hours?.devlogSeconds ?? 0,
		lapseSeconds: ship.hours?.lapseSeconds ?? 0,
		afterLastCommitSeconds: ship.hours?.afterLastCommitSeconds ?? 0,
		programSeconds: ship.hours?.programSeconds ?? 0,
		// already taken off hackatimeSeconds by the capture: shown so the lower figure makes sense
		aiDiscountedSeconds: ship.hours?.aiDiscountedSeconds ?? 0
	};
}

// a per-project split is only known when the ship links a single project
export function shipProjects(ship: LoadedShip): { name: string; seconds: number | null }[] {
	const single = ship.hackatimeProjects.length === 1;
	return ship.hackatimeProjects.map((name) => ({
		name,
		seconds: single
			? (ship.hours?.hackatimeSeconds ?? 0) + (ship.hours?.afterLastCommitSeconds ?? 0)
			: null
	}));
}
