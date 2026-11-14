<script lang="ts">
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';

	const { context, settlement } = useReview();

	const rows = $derived(settlement.recordedCuts);
</script>

{#if rows.length}
	<div class="cuts" data-hours-cut-rows>
		<h3>Rows cut by {context.recorded?.reviewerName ?? 'the reviewer'}</h3>
		<ul>
			{#each rows as row (`${row.kind}:${row.rowId}`)}
				<li data-cut-row="{row.kind}:{row.rowId}">
					<span class="label">{row.label}</span>
					<span class="value">
						{formatDuration(row.creditedSeconds)}
						<span class="captured">/ {formatDuration(row.capturedSeconds)}</span>
					</span>
					<span class="off">−{formatDuration(row.capturedSeconds - row.creditedSeconds)}</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.cuts {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--color-orange) 30%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-orange) 8%, var(--surface));
	}
	h3 {
		margin: 0;
		color: var(--color-orange);
		font-size: var(--text-xs);
		font-weight: 700;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
	}
	.label {
		flex: 1 0 auto;
		color: var(--text);
		font-weight: 600;
	}
	.value,
	.off {
		font-family: var(--font-mono);
		font-weight: 600;
		white-space: nowrap;
	}
	.value {
		color: var(--text-2);
	}
	.captured {
		color: var(--text-3);
	}
	.off {
		color: var(--color-orange);
	}
</style>
