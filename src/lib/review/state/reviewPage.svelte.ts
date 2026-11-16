import { getContext, setContext, tick } from 'svelte';
import { offerCutNotes } from './cutNotes.svelte';
import { EvidenceCursor } from './evidenceCursor.svelte';
import { RailSize } from './railSize.svelte';
import { ReviewClaim, type ClaimTiming } from './reviewClaim.svelte';
import { ReviewContext, type ReviewLoadData } from './reviewContext.svelte';
import { RefusalHandler, ReviewDecision } from './reviewDecision.svelte';
import { ReviewDraft, type DraftTiming } from './reviewDraft.svelte';
import { ReviewKeybinds } from './reviewKeybinds.svelte';
import { ReviewSettlement } from './reviewSettlement.svelte';
import { ReviewValidation } from './reviewValidation.svelte';
import { SecondPass } from './secondPass.svelte';
import { Wizard } from './wizard.svelte';

export interface ReviewTiming {
	claim?: ClaimTiming;
	draft?: DraftTiming;
}

const contextKey = Symbol('reviewPage');

export class ReviewPage {
	readonly context: ReviewContext;
	readonly claim: ReviewClaim;
	readonly draft: ReviewDraft;
	readonly settlement: ReviewSettlement;
	readonly validation: ReviewValidation;
	readonly refusal: RefusalHandler;
	readonly decision: ReviewDecision;
	readonly secondPass: SecondPass;
	readonly cursor: EvidenceCursor;
	readonly keybinds: ReviewKeybinds;
	readonly wizard: Wizard;
	readonly rail: RailSize;

	constructor(read: () => ReviewLoadData, timing: ReviewTiming = {}) {
		this.context = new ReviewContext(read);
		this.claim = new ReviewClaim(this.context, timing.claim);
		this.draft = new ReviewDraft(this.context, timing.draft);
		offerCutNotes(this.context, this.draft);
		this.settlement = new ReviewSettlement(this.context, this.draft);
		this.validation = new ReviewValidation(this.context, this.draft, this.settlement);
		this.wizard = new Wizard(this.context, this.draft);
		this.rail = new RailSize();
		this.cursor = new EvidenceCursor(this.context);
		this.keybinds = new ReviewKeybinds();
		const parts = {
			context: this.context,
			claim: this.claim,
			draft: this.draft,
			validation: this.validation,
			reveal: (field: string) => this.reveal(field)
		};
		this.refusal = new RefusalHandler(parts);
		this.decision = new ReviewDecision(parts, this.refusal);
		this.secondPass = new SecondPass(parts, this.refusal);
	}

	// opens whatever hides an input (the collapsed rail, another wizard step), then scrolls to
	// the element marked data-review-field="<field>" and focuses it
	async reveal(field: string): Promise<void> {
		if (this.rail.collapsed) await this.rail.show();
		this.wizard.goTo(this.wizard.stepOf(field));
		await tick();
		const marked = [...document.querySelectorAll<HTMLElement>('[data-review-field]')].find(
			(element) => element.dataset.reviewField === field
		);
		if (!marked) return;
		marked.scrollIntoView({ block: 'center', behavior: 'smooth' });
		const controls = 'input, textarea, select, button';
		const control = marked.matches(controls) ? marked : marked.querySelector<HTMLElement>(controls);
		control?.focus({ preventScroll: true });
	}
}

export function createReviewPage(read: () => ReviewLoadData, timing?: ReviewTiming): ReviewPage {
	const review = new ReviewPage(read, timing);
	setContext(contextKey, review);
	return review;
}

export function useReview(): ReviewPage {
	const review = getContext<ReviewPage | undefined>(contextKey);
	if (!review) throw new Error('useReview needs the review page above it');
	return review;
}
