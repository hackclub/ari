import { Prisma } from '$db';
import {
	clampSeconds,
	minutesToSeconds,
	splitProportional,
	toLegacyMinutes,
	toLegacyMinutesBreakdown
} from '$lib/time';
import {
	applyDeductions,
	applyDeflate,
	clampCollaboratorDeflates,
	settle,
	type Adjustments,
	type Deductions,
	type Evidence,
	type PersonSeconds,
	type Settlement,
	type SourceSeconds
} from '$lib/review/settlement';

export interface SettlementRows {
	commits: { id: string; codingSeconds: number; makerId?: string | null }[];
	devlogs: { id: string; seconds: number; makerId?: string | null }[];
	clips: { id: string; lengthSeconds: number; makerId?: string | null }[];
	hours?: {
		hackatimeSeconds: number;
		afterLastCommitSeconds: number;
		programSeconds: number;
	} | null;
	collaborators?: {
		makerId: string;
		hackatimeSeconds: number;
		afterLastCommitSeconds: number;
		programSeconds: number;
	}[];
}

export function evidenceFromRows(rows: SettlementRows): Evidence {
	return {
		commits: rows.commits.map((commit) => ({
			id: commit.id,
			codingSeconds: commit.codingSeconds,
			makerId: commit.makerId
		})),
		devlogs: rows.devlogs.map((devlog) => ({
			id: devlog.id,
			seconds: devlog.seconds,
			makerId: devlog.makerId
		})),
		clips: rows.clips.map((clip) => ({
			id: clip.id,
			lengthSeconds: clip.lengthSeconds,
			makerId: clip.makerId
		})),
		ship: {
			hackatimeSeconds: rows.hours?.hackatimeSeconds ?? 0,
			afterLastCommitSeconds: rows.hours?.afterLastCommitSeconds ?? 0,
			programSeconds: rows.hours?.programSeconds ?? 0
		},
		collaborators: (rows.collaborators ?? []).map((person) => ({
			makerId: person.makerId,
			hackatimeSeconds: person.hackatimeSeconds,
			afterLastCommitSeconds: person.afterLastCommitSeconds,
			programSeconds: person.programSeconds
		}))
	};
}

export type PersonMinutes = {
	total: number;
	hackatime: number;
	journals: number;
	lapse: number;
	program: number;
};

// the minute total is rounded once, then split, so the legacy sources always sum to it
export function legacyMinutes(totalSeconds: number, sources: SourceSeconds): PersonMinutes {
	const [hackatime, journals, lapse, program] = toLegacyMinutesBreakdown(totalSeconds, [
		sources.hackatime,
		sources.journals,
		sources.lapse,
		sources.program
	]);
	return { total: toLegacyMinutes(totalSeconds), hackatime, journals, lapse, program };
}

export interface StoredSettlement {
	adjustmentsSeconds: unknown;
	deflateSeconds: number | null;
	collaboratorDeflatesSeconds: unknown;
	deductionsSeconds?: unknown;
}

// what a version 3 review reports: its settlement replayed, then its stored deflate applied
export function replayStoredReview(review: StoredSettlement, rows: SettlementRows) {
	const settled = settle(review.adjustmentsSeconds, evidenceFromRows(rows));
	for (const person of rows.collaborators ?? []) {
		settled.collaborators[person.makerId] ??= {
			total: 0,
			hackatime: 0,
			journals: 0,
			lapse: 0,
			program: 0
		};
	}
	return applyDeductions(
		applyDeflate(settled, review.deflateSeconds, review.collaboratorDeflatesSeconds),
		review.deductionsSeconds,
		(rows.collaborators ?? []).length > 0
	);
}

export function storedDeductedSeconds(review: StoredSettlement, rows: SettlementRows): number {
	if (!review.deductionsSeconds) return 0;
	const without = replayStoredReview({ ...review, deductionsSeconds: null }, rows);
	return without.approvedSeconds - replayStoredReview(review, rows).approvedSeconds;
}

// old ari still writes minute-only reviews, whose seconds columns stay at their default
export const storedApprovedSeconds = (review: {
	settlementVersion: number;
	approvedMinutes: number;
	approvedSeconds: number;
}): number =>
	review.settlementVersion === 3
		? review.approvedSeconds
		: minutesToSeconds(review.approvedMinutes);

export interface DeflateRequest {
	deflateSeconds?: unknown;
	collaboratorDeflates?: unknown;
	// snapshotted so a replay reports the same total without asking where the cuts came from
	deductions?: Deductions;
}

// approvedSeconds and collaboratorSeconds stay the undeflated settlement: the cut is stored beside them
export function reviewColumns(settlement: Settlement, deflate: DeflateRequest = {}) {
	const { deflates, totalSeconds: perPersonSeconds } = clampCollaboratorDeflates(
		deflate.collaboratorDeflates,
		settlement.collaborators
	);
	const shipCutSeconds = clampSeconds(deflate.deflateSeconds, settlement.approvedSeconds);
	const deflateSeconds = perPersonSeconds > 0 ? perPersonSeconds : shipCutSeconds || null;
	const deflateMinutes = deflateSeconds === null ? null : toLegacyMinutes(deflateSeconds);
	const deductions = positiveSecondsMap(deflate.deductions);

	// old ari expects the per-person minutes to sum to deflateMinutes
	const deflatedMakerIds = Object.keys(deflates);
	const legacyDeflates = splitProportional(
		deflateMinutes ?? 0,
		deflatedMakerIds.map((makerId) => deflates[makerId])
	);

	const collaboratorMinutes: Record<string, PersonMinutes> = {};
	for (const [makerId, person] of Object.entries(settlement.collaborators)) {
		collaboratorMinutes[makerId] = legacyMinutes(person.total, person);
	}

	return {
		settlementVersion: 3,
		approvedSeconds: settlement.approvedSeconds,
		adjustmentsSeconds: settlement.adjustments as unknown as Prisma.InputJsonObject,
		collaboratorSeconds: settlement.collaborators as Record<string, PersonSeconds>,
		deflateSeconds,
		collaboratorDeflatesSeconds: perPersonSeconds > 0 ? deflates : Prisma.DbNull,
		deductionsSeconds: Object.keys(deductions).length ? deductions : Prisma.DbNull,
		approvedMinutes: toLegacyMinutes(settlement.approvedSeconds),
		// version 3 never replays from minutes
		adjustments: {},
		collaboratorMinutes,
		deflateMinutes,
		collaboratorDeflates:
			perPersonSeconds > 0
				? Object.fromEntries(
						deflatedMakerIds.map((makerId, index) => [makerId, legacyDeflates[index]])
					)
				: Prisma.DbNull
	};
}

const adjustmentKinds = ['devlogs', 'clips', 'hackatime', 'program', 'commits', 'after'] as const;

const storableSeconds = (value: unknown): number | null => clampSeconds(value, 2147483647); // postgres integer max: 2 ** 31 - 1

function positiveSecondsMap(raw: unknown): Record<string, number> {
	const seconds: Record<string, number> = {};
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return seconds;
	for (const [key, value] of Object.entries(raw)) {
		const clamped = storableSeconds(value);
		if (clamped) seconds[key] = clamped;
	}
	return seconds;
}

const toLegacyMinutesMap = (seconds: Record<string, number>): Record<string, number> =>
	Object.fromEntries(Object.entries(seconds).map(([key, value]) => [key, toLegacyMinutes(value)]));

export interface DraftRequest {
	adjustments?: unknown;
	deflateSeconds?: unknown;
	collaboratorDeflates?: unknown;
}

// a draft holds raw requests: they are clamped against the evidence only at decision time
export function draftColumns(draft: DraftRequest) {
	const requested = (draft.adjustments ?? {}) as Record<string, unknown>;
	const adjustmentsSeconds: Adjustments = {};
	const adjustments: Adjustments = {};
	for (const kind of adjustmentKinds) {
		const rows = requested[kind];
		if (!rows || typeof rows !== 'object' || Array.isArray(rows)) continue;
		const kept: Record<string, number> = {};
		for (const [rowId, value] of Object.entries(rows)) {
			const clamped = storableSeconds(value);
			if (clamped !== null) kept[rowId] = clamped;
		}
		if (Object.keys(kept).length === 0) continue;
		adjustmentsSeconds[kind] = kept;
		adjustments[kind] = toLegacyMinutesMap(kept);
	}

	const deflateSeconds = storableSeconds(draft.deflateSeconds) || null;
	const collaboratorDeflatesSeconds = positiveSecondsMap(draft.collaboratorDeflates);

	return {
		adjustmentsSeconds: adjustmentsSeconds as Prisma.InputJsonObject,
		deflateSeconds,
		// always written: an empty map clears a removed draft value on update
		collaboratorDeflatesSeconds,
		adjustments: adjustments as Prisma.InputJsonObject,
		deflateMinutes: deflateSeconds === null ? null : toLegacyMinutes(deflateSeconds),
		collaboratorDeflates: toLegacyMinutesMap(collaboratorDeflatesSeconds)
	};
}
