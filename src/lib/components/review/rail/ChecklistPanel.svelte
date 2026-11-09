<script lang="ts">
	import { Checkbox } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context, draft, validation, wizard } = useReview();
	const checklist = $derived(context.data.checklist);
	const ticked = $derived(draft.value.checks.filter(Boolean).length);
	const error = $derived(validation.errorFor('checklist'));
</script>

<section class={{ checklist: true, invalid: error !== null }} data-review-field="checklist">
	<h2>Checklist · {ticked} of {checklist.length}</h2>
	{#each checklist as item, index (index)}
		<Checkbox
			checked={draft.value.checks[index] ?? false}
			disabled={!draft.checksEditable}
			onchange={(event) => {
				draft.setCheck(index, event.currentTarget.checked);
				wizard.advanceWhenChecklistDone();
			}}
		>
			<span class={{ item: true, done: draft.value.checks[index] }}>{item.label}</span>
		</Checkbox>
	{/each}
	{#if error}<p class="error">{error}</p>{/if}
</section>

<style>
	.checklist {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		border-radius: var(--radius-md);
	}
	.invalid {
		outline: 2px solid color-mix(in srgb, var(--color-red) 65%, transparent);
		outline-offset: var(--space-2);
	}
	h2 {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.item {
		font-weight: 600;
		text-decoration: line-through transparent;
		transition:
			color 0.15s,
			text-decoration-color 0.15s;
	}
	.done {
		color: var(--text-2);
		text-decoration-color: currentColor;
	}
	.error {
		margin: 0;
		color: var(--color-red);
		font-size: var(--text-xs);
	}
</style>
