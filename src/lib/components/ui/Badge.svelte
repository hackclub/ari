<script lang="ts" module>
	export type BadgeTone =
		| 'pending'
		| 'processing'
		| 'approved'
		| 'changes'
		| 'rejected'
		| 'reverted'
		| 'withdrawn'
		| 'secondpass'
		| 'fraudreview'
		| 'neutral';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: BadgeTone;
		dot?: boolean;
		children: Snippet;
	}
	let { tone = 'neutral', dot = false, children }: Props = $props();
</script>

<span class={['badge', tone]}>
	{#if dot}<span class="dot"></span>{/if}
	{@render children()}
</span>

<style>
	.badge {
		--tone: var(--status-neutral);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 3px var(--space-2) 4px;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;
		color: var(--tone);
		background: color-mix(in srgb, var(--tone) 12%, var(--surface));
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
	}
	.pending,
	.processing {
		--tone: var(--status-pending);
	}
	.approved {
		--tone: var(--status-approved);
	}
	.changes {
		--tone: var(--status-changes);
	}
	.rejected {
		--tone: var(--status-rejected);
	}
	.secondpass {
		--tone: var(--status-secondpass);
	}
	.fraudreview {
		--tone: var(--status-fraudreview);
	}
</style>
