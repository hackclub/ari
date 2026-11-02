import type { Status, Evidence, Track, Collaborator } from '$lib/data';
import type { Submission, Maker, Review, User, HoursBreakdown, SubmissionCollaborator } from '$db';
import { storedApprovedSeconds } from '$lib/server/settlementStore';

// after-last-commit is left out: it only lands during enrichment
export function evidenceSeconds(hours: HoursBreakdown | null): number {
	if (!hours) return 0;
	return hours.hackatimeSeconds + hours.devlogSeconds + hours.lapseSeconds + hours.programSeconds;
}

export function ago(date: Date): string {
	const minutes = Math.floor((Date.now() - date.getTime()) / 60000); // ms in a minute: 60 * 1000
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes}m`; // minutes in an hour
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`; // hours in a day
	return `${Math.floor(hours / 24)}d`;
}

export function whenLabel(date: Date): string {
	const now = new Date();
	const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	const sameDay = (first: Date, second: Date) => first.toDateString() === second.toDateString();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (sameDay(date, now)) return `Today · ${time}`;
	if (sameDay(date, yesterday)) return `Yesterday · ${time}`;
	return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

// privacy: list queries select exactly these maker fields and nothing else
export const makerDisplaySelect = { name: true, email: true, slackId: true } as const;
export type MakerDisplay = Pick<Maker, keyof typeof makerDisplaySelect>;

type CollaboratorWithMaker = Pick<SubmissionCollaborator, 'makerId'> & { maker: MakerDisplay };

export type SubmissionWithMaker = Pick<
	Submission,
	| 'id'
	| 'title'
	| 'status'
	| 'track'
	| 'receivedAt'
	| 'acceptedEvidence'
	| 'thumbnailUrl'
	| 'priority'
	| 'authorNameOverrides'
> &
	Partial<Pick<Submission, 'queuedAt'>> & {
		maker: MakerDisplay;
		hours?: HoursBreakdown | null;
		collaborators?: CollaboratorWithMaker[];
	};

export function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

type ShipPeople = {
	maker: MakerDisplay;
	authorNameOverrides?: unknown;
	collaborators?: CollaboratorWithMaker[];
};

// malformed json is treated as absent so a bad value cannot break lists
export function authorNameOverrides(value: unknown): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const overrides: Record<string, string> = {};
	for (const [email, name] of Object.entries(value)) {
		if (typeof name === 'string' && name.trim()) overrides[email.toLowerCase()] = name.trim();
	}
	return overrides;
}

export function shipAuthorName(
	ship: Pick<ShipPeople, 'authorNameOverrides'>,
	maker: Pick<MakerDisplay, 'email' | 'name'>
) {
	return (
		authorNameOverrides(ship.authorNameOverrides)[maker.email.toLowerCase()] ??
		maker.name ??
		maker.email
	);
}

export function collaboratorList(ship: ShipPeople): Collaborator[] | undefined {
	if (!ship.collaborators?.length) return undefined;
	return ship.collaborators.map((collaborator) => ({
		makerId: collaborator.makerId,
		name: shipAuthorName(ship, collaborator.maker),
		slackId: collaborator.maker.slackId
	}));
}

export function authorLabel(ship: ShipPeople): string {
	const collaborators = collaboratorList(ship);
	return collaborators
		? joinNames(collaborators.map((collaborator) => collaborator.name))
		: shipAuthorName(ship, ship.maker);
}

export function submissionRow(submission: SubmissionWithMaker, programColor: string) {
	const collaborators = collaboratorList(submission);
	return {
		id: submission.id,
		title: submission.title,
		author: authorLabel(submission),
		authorSlackId: collaborators ? null : submission.maker.slackId,
		collaborators,
		evidenceSeconds: evidenceSeconds(submission.hours ?? null),
		status: submission.status as Status,
		track: submission.track as Track,
		ago: ago(submission.queuedAt ?? submission.receivedAt),
		evidence: (submission.acceptedEvidence[0] ?? 'commits') as Evidence,
		color: programColor,
		thumb: submission.thumbnailUrl,
		priority: submission.priority
	};
}

export type ReviewedSubmission = Pick<
	Submission,
	'id' | 'title' | 'status' | 'track' | 'receivedAt' | 'thumbnailUrl' | 'authorNameOverrides'
> & {
	maker: MakerDisplay;
	hours?: HoursBreakdown | null;
	collaborators?: CollaboratorWithMaker[];
	reviews: (Pick<
		Review,
		'approvedMinutes' | 'approvedSeconds' | 'settlementVersion' | 'createdAt'
	> & {
		reviewer: Pick<User, 'name' | 'avatarColor' | 'slackId'>;
	})[];
};

export interface Reviewed {
	id: string;
	title: string;
	author: string;
	authorSlackId: string | null;
	collaborators?: Collaborator[];
	color: string;
	approvedSeconds: number;
	status: Status;
	track: Track;
	thumb: string | null;
	reviewerName: string;
	reviewerColor: string;
	reviewerSlackId: string | null;
	when: string;
}

export function reviewedRow(submission: ReviewedSubmission, programColor: string): Reviewed {
	const lastReview = submission.reviews[0];
	const collaborators = collaboratorList(submission);
	return {
		thumb: submission.thumbnailUrl,
		id: submission.id,
		title: submission.title,
		author: authorLabel(submission),
		authorSlackId: collaborators ? null : submission.maker.slackId,
		collaborators,
		color: programColor,
		approvedSeconds: lastReview
			? storedApprovedSeconds(lastReview)
			: evidenceSeconds(submission.hours ?? null),
		status: submission.status as Status,
		track: submission.track as Track,
		reviewerName: lastReview?.reviewer.name ?? '-',
		reviewerColor: lastReview?.reviewer.avatarColor ?? programColor,
		reviewerSlackId: lastReview?.reviewer.slackId ?? null,
		when: lastReview ? whenLabel(lastReview.createdAt) : ago(submission.receivedAt)
	};
}

export function commitAuthorLabel(
	authorName: string | null,
	authorEmail: string | null
): string | null {
	if (authorName) return authorName;
	const match = authorEmail?.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
	if (match) return match[1];
	return authorEmail;
}
