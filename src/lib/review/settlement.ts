import { clampSeconds, scaleToTarget, splitProportional } from '$lib/time';

export type TimeSource = 'hackatime' | 'journals' | 'lapse' | 'program';
const timeSources: TimeSource[] = ['hackatime', 'journals', 'lapse', 'program'];

export type SourceSeconds = Record<TimeSource, number>;
export type PersonSeconds = SourceSeconds & { total: number };
export type CollaboratorSeconds = Record<string, PersonSeconds>;

export const soloHackatimeKey = 'hackatime';
export const programKey = 'program';
export const afterLastCommitKey = 'after';

export interface Adjustments {
	devlogs?: Record<string, number>;
	clips?: Record<string, number>;
	hackatime?: Record<string, number>;
	program?: Record<string, number>;
	commits?: Record<string, number>;
	after?: Record<string, number>;
}

export interface Evidence {
	commits: { id: string; codingSeconds: number; makerId?: string | null }[];
	devlogs: { id: string; seconds: number; makerId?: string | null }[];
	clips: { id: string; lengthSeconds: number; makerId?: string | null }[];
	ship: { hackatimeSeconds: number; afterLastCommitSeconds: number; programSeconds: number };
	collaborators: {
		makerId: string;
		hackatimeSeconds: number;
		afterLastCommitSeconds: number;
		programSeconds: number;
	}[];
}

export interface Settlement {
	adjustments: Required<Adjustments>;
	approvedSeconds: number;
	breakdown: SourceSeconds;
	collaborators: CollaboratorSeconds;
}

const emptyPerson = (): PersonSeconds => ({
	total: 0,
	hackatime: 0,
	journals: 0,
	lapse: 0,
	program: 0
});

// a stale capture left tracked seconds empty while commits survive: settle from commits
export function usesCommitFallback(evidence: Evidence): boolean {
	const people = evidence.collaborators;
	const trackedSeconds = people.length
		? people.reduce((sum, person) => sum + person.hackatimeSeconds, 0)
		: evidence.ship.hackatimeSeconds;
	return trackedSeconds === 0 && evidence.commits.some((commit) => commit.codingSeconds > 0);
}

// their time counts for nothing: their own rows go to zero and their share of a shared row comes
// off it, so nobody else is credited with it. they stay on the ship so the program hears them at zero.
// only a teammate is ever excluded: a solo ship is decided as a whole
export function withoutPeople(evidence: Evidence, makerIds: string[]): Evidence {
	const people = evidence.collaborators;
	const excluded = new Set(
		makerIds.filter((makerId) => people.some((person) => person.makerId === makerId))
	);
	if (!excluded.size) return evidence;
	const keptSeconds = (totalSeconds: number, weights: number[]) => {
		const shares = splitProportional(totalSeconds, weights);
		return people.reduce(
			(kept, person, index) => (excluded.has(person.makerId) ? kept - shares[index] : kept),
			totalSeconds
		);
	};
	const theirs = (makerId?: string | null) => Boolean(makerId && excluded.has(makerId));
	return {
		commits: evidence.commits.map((commit) =>
			theirs(commit.makerId) ? { ...commit, codingSeconds: 0 } : commit
		),
		devlogs: evidence.devlogs.map((devlog) =>
			theirs(devlog.makerId) ? { ...devlog, seconds: 0 } : devlog
		),
		clips: evidence.clips.map((clip) =>
			theirs(clip.makerId) ? { ...clip, lengthSeconds: 0 } : clip
		),
		ship: {
			hackatimeSeconds: evidence.ship.hackatimeSeconds,
			afterLastCommitSeconds: keptSeconds(
				evidence.ship.afterLastCommitSeconds,
				people.map((person) => person.afterLastCommitSeconds)
			),
			programSeconds: keptSeconds(
				evidence.ship.programSeconds,
				people.map((person) => person.programSeconds)
			)
		},
		collaborators: people.map((person) =>
			excluded.has(person.makerId)
				? {
						makerId: person.makerId,
						hackatimeSeconds: 0,
						afterLastCommitSeconds: 0,
						programSeconds: 0
					}
				: person
		)
	};
}

export function settle(rawAdjustments: unknown, evidence: Evidence): Settlement {
	const requested = (rawAdjustments ?? {}) as Record<string, Record<string, unknown> | undefined>;
	const adjustments: Required<Adjustments> = {
		devlogs: {},
		clips: {},
		hackatime: {},
		program: {},
		commits: {},
		after: {}
	};
	const collaborators: CollaboratorSeconds = {};

	const credit = (makerId: string | null | undefined, source: TimeSource, seconds: number) => {
		if (!makerId || seconds === 0) return;
		const person = (collaborators[makerId] ??= emptyPerson());
		person[source] += seconds;
		person.total += seconds;
	};

	const settleRow = (kind: keyof Adjustments, rowId: string, capturedSeconds: number): number => {
		const requestedSeconds = clampSeconds(requested[kind]?.[rowId], capturedSeconds);
		const settledSeconds = requestedSeconds ?? capturedSeconds;
		if (settledSeconds !== capturedSeconds) adjustments[kind][rowId] = settledSeconds;
		return settledSeconds;
	};

	const settleItems = (
		kind: 'devlogs' | 'clips' | 'commits',
		source: TimeSource,
		items: { id: string; seconds: number; makerId?: string | null }[]
	): number => {
		let sourceTotal = 0;
		for (const item of items) {
			const settledSeconds = settleRow(kind, item.id, item.seconds);
			credit(item.makerId, source, settledSeconds);
			sourceTotal += settledSeconds;
		}
		return sourceTotal;
	};

	const settleSharedRow = (
		kind: 'program' | 'after',
		rowKey: string,
		source: TimeSource,
		capturedSeconds: number,
		weights: number[]
	): number => {
		const settledSeconds = settleRow(kind, rowKey, capturedSeconds);
		const shares = splitProportional(settledSeconds, weights);
		evidence.collaborators.forEach((person, index) =>
			credit(person.makerId, source, shares[index])
		);
		return settledSeconds;
	};

	const journals = settleItems('devlogs', 'journals', evidence.devlogs);
	const lapse = settleItems(
		'clips',
		'lapse',
		evidence.clips.map((clip) => ({
			id: clip.id,
			seconds: clip.lengthSeconds,
			makerId: clip.makerId
		}))
	);

	const people = evidence.collaborators;
	const useCommitFallback = usesCommitFallback(evidence);

	let hackatime: number;
	if (useCommitFallback) {
		hackatime = settleItems(
			'commits',
			'hackatime',
			evidence.commits.map((commit) => ({
				id: commit.id,
				seconds: commit.codingSeconds,
				makerId: commit.makerId
			}))
		);
		hackatime += settleSharedRow(
			'after',
			afterLastCommitKey,
			'hackatime',
			evidence.ship.afterLastCommitSeconds,
			people.map((person) => person.afterLastCommitSeconds)
		);
	} else if (people.length) {
		hackatime = 0;
		for (const person of people) {
			const settledSeconds = settleRow('hackatime', person.makerId, person.hackatimeSeconds);
			credit(person.makerId, 'hackatime', settledSeconds);
			hackatime += settledSeconds;
		}
	} else {
		hackatime = settleRow('hackatime', soloHackatimeKey, evidence.ship.hackatimeSeconds);
	}

	const program = settleSharedRow(
		'program',
		programKey,
		'program',
		evidence.ship.programSeconds,
		people.map((person) => person.programSeconds)
	);

	return {
		adjustments,
		approvedSeconds: hackatime + journals + lapse + program,
		breakdown: { hackatime, journals, lapse, program },
		collaborators
	};
}

export type CollaboratorDeflates = Record<string, number>;

export function clampCollaboratorDeflates(
	rawDeflates: unknown,
	collaborators: CollaboratorSeconds
): { deflates: CollaboratorDeflates; totalSeconds: number } {
	const requested = (rawDeflates ?? {}) as Record<string, unknown>;
	const deflates: CollaboratorDeflates = {};
	let totalSeconds = 0;
	for (const [makerId, person] of Object.entries(collaborators)) {
		const cutSeconds = clampSeconds(requested[makerId], person.total);
		if (!cutSeconds) continue;
		deflates[makerId] = cutSeconds;
		totalSeconds += cutSeconds;
	}
	return { deflates, totalSeconds };
}

type Settled = Pick<Settlement, 'approvedSeconds' | 'breakdown' | 'collaborators'>;

const toSourceList = (seconds: SourceSeconds) => timeSources.map((source) => seconds[source]);
const fromSourceList = (values: number[]): SourceSeconds => ({
	hackatime: values[0],
	journals: values[1],
	lapse: values[2],
	program: values[3]
});
const withTotal = (seconds: SourceSeconds): PersonSeconds => ({
	...seconds,
	total: seconds.hackatime + seconds.journals + seconds.lapse + seconds.program
});

export function applyDeflate(
	settled: Settled,
	deflateSeconds: number | null | undefined,
	rawCollaboratorDeflates?: unknown
): Settled {
	const { deflates, totalSeconds: perPersonTotal } = clampCollaboratorDeflates(
		rawCollaboratorDeflates,
		settled.collaborators
	);

	// per-person cuts win: callers store their sum as deflateSeconds, so both would cut twice
	if (perPersonTotal > 0) {
		const collaborators: CollaboratorSeconds = {};
		const breakdown: SourceSeconds = { ...settled.breakdown };
		for (const [makerId, person] of Object.entries(settled.collaborators)) {
			const cutSeconds = deflates[makerId] ?? 0;
			const scaled = fromSourceList(scaleToTarget(toSourceList(person), person.total - cutSeconds));
			collaborators[makerId] = withTotal(scaled);
			for (const source of timeSources) {
				breakdown[source] = Math.max(0, breakdown[source] - (person[source] - scaled[source]));
			}
		}
		return {
			approvedSeconds: settled.approvedSeconds - perPersonTotal,
			breakdown,
			collaborators
		};
	}

	const cutSeconds = clampSeconds(deflateSeconds ?? 0, settled.approvedSeconds) ?? 0;
	if (cutSeconds === 0) return settled;
	const targetSeconds = settled.approvedSeconds - cutSeconds;

	const breakdown = fromSourceList(scaleToTarget(toSourceList(settled.breakdown), targetSeconds));

	const makerIds = Object.keys(settled.collaborators);
	const cells = makerIds.flatMap((makerId) => toSourceList(settled.collaborators[makerId]));
	const attributedSeconds = cells.reduce((sum, cell) => sum + cell, 0);
	const attributedTarget =
		attributedSeconds === settled.approvedSeconds
			? targetSeconds
			: splitProportional(targetSeconds, [
					attributedSeconds,
					settled.approvedSeconds - attributedSeconds
				])[0];
	const scaledCells = scaleToTarget(cells, attributedTarget);
	const collaborators: CollaboratorSeconds = {};
	makerIds.forEach((makerId, index) => {
		const offset = index * timeSources.length;
		collaborators[makerId] = withTotal(
			fromSourceList(scaledCells.slice(offset, offset + timeSources.length))
		);
	});

	return { approvedSeconds: targetSeconds, breakdown, collaborators };
}
