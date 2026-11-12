<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		value: string | number;
		unit?: string;
		subLabel?: string;
		tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
		children?: Snippet;
	}
	let { label, value, unit, subLabel, tone = 'neutral', children }: Props = $props();
</script>

<div class={['statTile', tone]}>
	<div class="label">{label}</div>
	<div class="value">
		{value}{#if unit}<span class="unit">{unit}</span>{/if}
	</div>
	{#if subLabel}<div class="subLabel">{subLabel}</div>{/if}
	{#if children}<div class="extra">{@render children()}</div>{/if}
</div>

<style>
	.statTile {
		--tone: var(--text-2);
		min-width: 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	.ok {
		--tone: var(--color-green);
	}
	.warn {
		--tone: var(--color-orange);
	}
	.danger {
		--tone: var(--color-red);
	}
	.info {
		--tone: var(--color-blue);
	}
	.label {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.value {
		margin-top: var(--space-1);
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.unit {
		margin-left: 3px;
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--text-2);
	}
	.subLabel {
		margin-top: var(--space-1);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--tone);
	}
	.extra {
		margin-top: var(--space-2);
	}
</style>
