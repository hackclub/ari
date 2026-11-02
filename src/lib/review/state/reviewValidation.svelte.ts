import type { ReviewProblem } from '$lib/review/reviewRules';
import {
	confirmNoteGaps,
	problemsForAction,
	type ReviewAction,
	type RuleSources
} from './decisionOutcome';
import type { ReviewContext } from './reviewContext.svelte';
import type { ReviewDraft } from './reviewDraft.svelte';
import type { ReviewSettlement } from './reviewSettlement.svelte';

const allActions: ReviewAction[] = [
	'approve',
	'changes',
	'reject',
	'confirm',
	'confirmChanges',
	'confirmReject'
];

// what stands between the draft and each decision, from the rules the server enforces
export class ReviewValidation {
	// the action the reviewer last tried: its problems are the ones fields highlight
	attempted = $state<ReviewAction | null>(null);
	#refused = $state.raw<{
		action: ReviewAction;
		shipKey: string;
		problems: ReviewProblem[];
	} | null>(null);

	readonly #context: ReviewContext;
	readonly #draft: ReviewDraft;
	readonly #settlement: ReviewSettlement;

	constructor(context: ReviewContext, draft: ReviewDraft, settlement: ReviewSettlement) {
		this.#context = context;
		this.#draft = draft;
		this.#settlement = settlement;

		$effect.pre(() => {
			void context.shipKey;
			this.attempted = null;
			this.#refused = null;
		});
	}

	readonly #sources: RuleSources = $derived.by(() => {
		const context = this.#context;
		const recorded = context.recorded;
		// a held ship whose time the organizer left alone is judged on the held values
		const heldTime = this.#settlement.showsRecorded && recorded;
		return {
			status: context.ship.status,
			hoursJustification: context.data.rules.hoursJustification,
			checklistCount: context.data.checklist.length,
			customFields: context.data.customFields,
			requiredFixIds: context.data.fixes.map((fix) => fix.reviewId),
			draft: this.#draft.value,
			settlement: heldTime
				? { adjustments: heldTime.adjustments }
				: this.#settlement.preview.settlement,
			deflateSeconds: heldTime ? heldTime.deflateSeconds : this.#settlement.preview.deflateSeconds,
			canAct: !context.readOnly,
			canSecondPass: context.viewer.canSecondPass,
			isPoc: context.viewer.isPoc,
			held: context.secondPass
				? {
						decision: context.heldDecision ?? 'approved',
						madeByViewer: recorded?.madeByViewer ?? false
					}
				: null
		};
	});

	readonly #problems = $derived(
		Object.fromEntries(
			allActions.map((action) => [action, problemsForAction(action, this.#sources)])
		) as Record<ReviewAction, ReviewProblem[]>
	);

	problemsFor(action: ReviewAction): ReviewProblem[] {
		return this.#problems[action];
	}

	canDecide(action: ReviewAction): boolean {
		return this.#problems[action].length === 0;
	}

	// the "why can't I approve" line: the first problem the server would name, or null
	whyNot(action: ReviewAction): string | null {
		return this.#problems[action][0]?.message ?? null;
	}

	// the notes a first-pass decision would need that a confirm does not: shown, never enforced
	confirmGaps(action: ReviewAction): ReviewProblem[] {
		return confirmNoteGaps(action, this.#sources);
	}

	// problems to show right now: the attempted action's live ones, then anything the server
	// refused that the client rules did not predict
	readonly shown: ReviewProblem[] = $derived.by(() => {
		const action = this.attempted;
		if (!action) return [];
		const live = this.#problems[action];
		const refused =
			this.#refused?.action === action && this.#refused.shipKey === this.#context.shipKey
				? this.#refused.problems.filter(
						(problem) => !live.some((known) => known.code === problem.code)
					)
				: [];
		return [...live, ...refused];
	});

	// field is a ReviewProblem.field: note, audit, technicalFeatures, deflationReason,
	// checklist, fixChecks or field:<key>. null until a decision was tried
	problemFor(field: string): ReviewProblem | null {
		return this.shown.find((problem) => problem.field === field) ?? null;
	}

	errorFor(field: string): string | null {
		return this.problemFor(field)?.message ?? null;
	}

	// marks the action as tried so its problems highlight. true when nothing blocks it
	attempt(action: ReviewAction): boolean {
		this.attempted = action;
		this.#refused = null;
		return this.canDecide(action);
	}

	// a refusal from the server, mapped back onto the same fields
	refuse(action: ReviewAction, problems: ReviewProblem[]): void {
		this.attempted = action;
		this.#refused = { action, shipKey: this.#context.shipKey, problems };
	}

	clear(): void {
		this.attempted = null;
		this.#refused = null;
	}
}
