<script lang="ts">
	import { submitAction } from '$lib/actions';
	import { Button, Textarea } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context } = useReview();
	const actionUrl = $derived(`/p/${context.programId}/review/${context.ship.id}`);

	let baseline = $state(context.ship.reviewerNote ?? '');
	let text = $state(context.ship.reviewerNote ?? '');
	let saving = $state(false);
	let failure = $state<string | null>(null);

	const editable = $derived(context.viewer.canReview);
	const dirty = $derived(text !== baseline);

	async function save() {
		if (saving || !dirty || !editable) return;
		saving = true;
		failure = null;
		const result = await submitAction(
			'saveReviewerNote',
			{ reviewerNote: text },
			{ actionUrl, invalidate: false, fallbackMessage: 'Could not save the reviewer note.' }
		);
		saving = false;
		if (!result.ok) {
			failure = result.message;
			return;
		}
		baseline = text;
	}
</script>

<div class="reviewerNote" data-review-field="reviewerNote">
	<Textarea
		label="Reviewer note"
		name="reviewerNote"
		autoGrow
		rows={2}
		maxlength={10000}
		hint="Internal, only on this review page. Saves without a decision."
		readonly={!editable}
		bind:value={text}
	/>
	{#if failure}
		<p class="failure">{failure}</p>
	{/if}
	{#if editable}
		<Button variant="soft" size="sm" icon="check" disabled={!dirty} loading={saving} onclick={save}>
			{saving ? 'Saving…' : dirty ? 'Save note' : 'Saved'}
		</Button>
	{/if}
</div>

<style>
	.reviewerNote {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;
	}
	.failure {
		margin: 0;
		color: var(--color-red);
		font-size: var(--text-xs);
	}
</style>
