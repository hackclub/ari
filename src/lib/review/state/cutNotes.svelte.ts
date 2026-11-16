import { untrack } from 'svelte';
import { browser } from '$app/environment';
import { planCutNotes, readOfferedNotes } from '$lib/review/cutNotes';
import type { ReviewContext } from './reviewContext.svelte';
import type { ReviewDraft } from './reviewDraft.svelte';

// call while the review page is being set up: the rail unmounts when collapsed
export function offerCutNotes(context: ReviewContext, draft: ReviewDraft): void {
	// a held ship's edits live on this page only, so what it was offered does too
	let heldOffer: { shipKey: string; notes: string[] } | null = null;

	function offer(storageKey: string, notes: string[], shipKey: string, remembers: boolean) {
		let offered = heldOffer?.shipKey === shipKey ? heldOffer.notes : [];
		try {
			if (remembers) offered = readOfferedNotes(localStorage.getItem(storageKey));
		} catch {
			// without storage the notes are offered again on the next open
		}
		const plan = planCutNotes({ notes, offered, reason: draft.value.deflationReason });
		heldOffer = remembers ? null : { shipKey, notes: plan.offered };
		try {
			if (remembers && plan.offered.length)
				localStorage.setItem(storageKey, JSON.stringify(plan.offered));
			else localStorage.removeItem(storageKey);
		} catch {
			// the draft itself still carries the notes
		}
		if (plan.reason !== draft.value.deflationReason) draft.value.deflationReason = plan.reason;
	}

	$effect(() => {
		const notes = context.data.automaticCutNotes;
		const storageKey = `ari-review-cutNotes:${context.programId}:${context.ship.id}`;
		// a held ship is seeded from the recorded decision on every open, with nothing saved in
		// between: what was offered last time is not in it
		const remembers = !context.closed;
		// the draft is seeded again when this changes: another ship, or this one reopened
		const shipKey = context.shipKey;
		if (!browser || !draft.editable || !context.wantsJustification) return;
		untrack(() => offer(storageKey, notes, shipKey, remembers));
	});
}
