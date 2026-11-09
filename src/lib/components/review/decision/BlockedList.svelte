<script lang="ts">
	import { Button, Icon } from '$lib/components/ui';
	import type { ReviewAction } from '$lib/review/state/decisionOutcome';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	interface Props {
		action: ReviewAction;
		heading: string;
	}
	let { action, heading }: Props = $props();

	const review = useReview();
	const { validation } = review;

	const problems = $derived(validation.problemsFor(action));
	// these name something to fix on screen. the rest (the claim, the status) are only stated
	const fixable = (field: string) => !['claim', 'status', 'permission'].includes(field);

	function show(field: string) {
		validation.attempt(action);
		void review.reveal(field);
	}
</script>

{#if problems.length}
	<div class="blocked" data-review-region="approveBlocked">
		<p><Icon name="clock" size={13} /> {heading}</p>
		<ul>
			{#each problems as problem (problem.code + problem.field)}
				<li data-problem={problem.code}>
					{#if fixable(problem.field)}
						<Button
							size="sm"
							variant="quiet"
							iconAfter="arrowR"
							onclick={() => show(problem.field)}
						>
							{problem.message}
						</Button>
					{:else}
						<span>{problem.message}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.blocked {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		color: var(--color-orange);
		font-size: var(--text-xs);
	}
	p {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		font-weight: 600;
	}
	ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li :global(.button) {
		justify-content: space-between;
		width: 100%;
		height: auto;
		min-height: var(--control-sm);
		padding-block: var(--space-1);
		color: inherit;
		font-size: inherit;
		text-align: left;
		white-space: normal;
	}
	li span {
		display: block;
		padding: var(--space-1) var(--space-2);
	}
</style>
