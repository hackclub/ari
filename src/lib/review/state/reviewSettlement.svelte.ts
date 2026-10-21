import {
	usesCommitFallback,
	type PersonSeconds,
	type SourceSeconds,
	type TimeSource
} from '$lib/review/settlement';
import { previewSettlement, type SettlementPreview } from '$lib/review/settlementPreview';
import type { AdjustmentKind } from './draftSeed';
import type { ReviewContext } from './reviewContext.svelte';
import type { ReviewDraft } from './reviewDraft.svelte';

export interface SourceRow {
	source: TimeSource;
	label: string;
	capturedSeconds: number;
	// after the row reductions, before the deflate
	settledSeconds: number;
	// after the deflate: what the program is told
	reportedSeconds: number;
}

export interface PersonRow {
	makerId: string;
	name: string;
	slackId: string | null;
	captured: PersonSeconds;
	settled: PersonSeconds;
	reported: PersonSeconds;
	// this person's own cut, when the reviewer set one
	deflateSeconds: number;
}

const sourceLabels: Record<TimeSource, string> = {
	hackatime: 'Hackatime',
	journals: 'Devlogs',
	lapse: 'Timelapses',
	program: 'Program-added'
};
const sources: TimeSource[] = ['hackatime', 'journals', 'lapse', 'program'];

const noPerson = (): PersonSeconds => ({
	total: 0,
	hackatime: 0,
	journals: 0,
	lapse: 0,
	program: 0
});

// every number comes from previewSettlement, the function the server settles with
export class ReviewSettlement {
	readonly #context: ReviewContext;
	readonly #draft: ReviewDraft;

	constructor(context: ReviewContext, draft: ReviewDraft) {
		this.#context = context;
		this.#draft = draft;
	}

	readonly preview: SettlementPreview = $derived.by(() =>
		previewSettlement(this.#context.data.settlementEvidence, {
			adjustments: this.#draft.value.adjustments,
			deflateSeconds: this.#draft.value.deflateSeconds,
			collaboratorDeflates: this.#draft.value.collaboratorDeflates,
			allowDeflation: this.#context.data.rules.allowDeflation
		})
	);

	// the same evidence with nothing asked for: the captured time per source and per person
	readonly #captured = $derived.by(
		() =>
			previewSettlement(this.#context.data.settlementEvidence, {
				adjustments: {},
				deflateSeconds: null,
				collaboratorDeflates: {},
				allowDeflation: false
			}).settlement
	);

	// a closed ship shows what was recorded, replayed under the model that decided it. an
	// organizer who changes a held ship's time sees it re-settled in seconds from then on
	readonly showsRecorded = $derived.by(
		() =>
			this.#context.closed &&
			this.#context.recorded !== null &&
			!(this.#context.canEditHeld && this.#draft.timeEdited)
	);

	readonly reported = $derived.by(() =>
		this.showsRecorded && this.#context.recorded
			? this.#context.recorded.reported
			: this.preview.reported
	);

	// the capture lost its tracked time, so the commit rows and the time after the last commit
	// are what settles: those rows are the editable ones
	readonly commitsEditable = $derived.by(() =>
		usesCommitFallback(this.#context.data.settlementEvidence)
	);

	// a version 1 review credited commits whatever the evidence says now: while its recorded
	// numbers are on screen the commit rows show what it credited, read only
	readonly #recordedAnchored = $derived.by(
		() => this.showsRecorded && this.#context.recorded?.settlementVersion === 1
	);

	readonly commitAnchored = $derived(this.commitsEditable || this.#recordedAnchored);

	#recordedRow(kind: AdjustmentKind, rowId: string): number | null {
		if (!this.#recordedAnchored || (kind !== 'commits' && kind !== 'after')) return null;
		return this.#context.recorded?.adjustments[kind]?.[rowId] ?? null;
	}

	readonly capturedSeconds = $derived(this.preview.capturedSeconds);
	// before the deflate: what the review row stores
	readonly settledSeconds = $derived(this.preview.settlement.approvedSeconds);
	// what the row reductions took off
	readonly reducedSeconds = $derived(this.capturedSeconds - this.settledSeconds);
	readonly deflateSeconds = $derived(this.preview.deflateSeconds ?? 0);
	readonly approvedSeconds = $derived(this.reported.approvedSeconds);
	readonly deflated = $derived(this.preview.deflated);
	readonly maxDeflateSeconds = $derived(this.settledSeconds);

	readonly breakdown: SourceSeconds = $derived(this.reported.breakdown);

	readonly sourceRows: SourceRow[] = $derived(
		sources.map((source) => ({
			source,
			label: sourceLabels[source],
			capturedSeconds: this.#captured.breakdown[source],
			settledSeconds: this.preview.settlement.breakdown[source],
			reportedSeconds: this.reported.breakdown[source]
		}))
	);

	// one entry per collaborator, in the ship's order. empty on a solo ship
	readonly people: PersonRow[] = $derived.by(() =>
		(this.#context.data.collaborators ?? [])
			.filter((person) => !person.excluded)
			.map((person) => ({
				makerId: person.makerId,
				name: person.name,
				slackId: person.slackId,
				captured: this.#captured.collaborators[person.makerId] ?? noPerson(),
				settled: this.preview.settlement.collaborators[person.makerId] ?? noPerson(),
				reported: this.reported.collaborators[person.makerId] ?? noPerson(),
				deflateSeconds: this.preview.collaboratorDeflates[person.makerId] ?? 0
			}))
	);

	person(makerId: string): PersonRow | null {
		return this.people.find((row) => row.makerId === makerId) ?? null;
	}

	// what one evidence row settles to: its reduction once clamped, else all of it
	rowSeconds(kind: AdjustmentKind, rowId: string, capturedSeconds: number): number {
		const recorded = this.#recordedRow(kind, rowId);
		if (recorded !== null) return Math.min(recorded, capturedSeconds);
		return this.preview.settlement.adjustments[kind][rowId] ?? capturedSeconds;
	}

	rowReduced(kind: AdjustmentKind, rowId: string): boolean {
		if (this.#recordedAnchored && (kind === 'commits' || kind === 'after'))
			return this.#recordedRow(kind, rowId) !== null;
		return rowId in this.preview.settlement.adjustments[kind];
	}
}
