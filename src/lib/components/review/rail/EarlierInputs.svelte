<script lang="ts">
	import NoteQuote from '$lib/components/review/decision/NoteQuote.svelte';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context } = useReview();

	const labels = {
		timeEvidence: 'Time evidence',
		supportingEvidence: 'Supporting evidence',
		hoursReasoning: 'Why the hours match the work',
		additionalJustification: 'Extra context'
	} as const;
	type InputKey = keyof typeof labels;

	const written = $derived.by(() => {
		const inputs = context.recorded?.earlierInputs;
		if (!inputs) return [];
		return (Object.keys(labels) as InputKey[])
			.filter((key) => inputs[key].trim())
			.map((key) => ({ key, label: labels[key], text: inputs[key] }));
	});
</script>

{#if written.length}
	<section class="earlier" data-review-region="earlierInputs">
		<h2>Recorded on an earlier review flow</h2>
		<p>
			{context.recorded?.reviewerName ?? 'The reviewer'} wrote these when reviews still asked for them.
			They are kept as written and can't be edited.
		</p>
		{#each written as input (input.key)}
			<div data-earlier-input={input.key}>
				<NoteQuote label={input.label} text={input.text} internal />
			</div>
		{/each}
	</section>
{/if}

<style>
	.earlier {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	p {
		margin: 0;
		color: var(--text-3);
		font-size: var(--text-xs);
		line-height: 1.5;
	}
</style>
