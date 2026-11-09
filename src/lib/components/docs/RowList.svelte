<script lang="ts">
	import InlineText from './InlineText.svelte';
	import type { DocRow } from './types';

	let { rows }: { rows: DocRow[] } = $props();
</script>

<div class="rows">
	{#each rows as row (`${row.code ?? ''}${row.name}`)}
		<div class="row">
			{#if row.code}<span class={['chip', row.ok ? 'ok' : 'err']}>{row.code}</span>{/if}
			<span class={['name', row.mono && 'mono']}>{row.name}</span>
			<span class="description"><InlineText text={row.description} /></span>
		</div>
	{/each}
</div>

<style>
	.rows {
		margin-top: var(--space-4);
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-3) 2px;
		border-bottom: 1px solid var(--doc-line-soft);
	}
	.row:first-child {
		border-top: 1px solid var(--doc-line-soft);
	}
	.chip {
		flex: 0 0 auto;
		min-width: 44px;
		padding: 3px var(--space-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		text-align: center;
	}
	.ok {
		color: var(--color-green);
		background: color-mix(in srgb, var(--color-green) 15%, transparent);
	}
	.err {
		color: var(--color-red);
		background: color-mix(in srgb, var(--color-red) 15%, transparent);
	}
	.name {
		flex: 0 0 auto;
		min-width: 128px;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);
	}
	.mono {
		font-family: var(--font-mono);
		font-weight: 500;
	}
	.description {
		font-size: var(--text-sm);
		line-height: 1.55;
		color: var(--text-2);
	}
</style>
