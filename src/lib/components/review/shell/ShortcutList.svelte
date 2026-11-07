<script lang="ts">
	import { Button, Kbd } from '$lib/components/ui';
	import type { ReviewKeybinds } from '$lib/review/state/reviewKeybinds.svelte';

	interface Props {
		keybinds: ReviewKeybinds;
		dimInactive?: boolean;
		escLabel?: string;
	}

	let { keybinds, dimInactive = true, escLabel = undefined }: Props = $props();

	const listening = (id: string) => keybinds.capturing === id;
</script>

<ul class="rows" data-review-region="shortcuts">
	{#each keybinds.rows as row (row.id)}
		<li class={{ inactive: dimInactive && !row.active }} data-shortcut={row.id}>
			<span class="label">{row.label}</span>
			{#if row.custom}
				<Button
					size="sm"
					variant="quiet"
					icon="refresh"
					aria-label="Reset {row.label} to its default"
					title="Reset to default"
					onclick={() => keybinds.reset(row.id)}
				/>
			{/if}
			<Button
				size="sm"
				variant={listening(row.id) ? 'primary' : 'ghost'}
				aria-pressed={listening(row.id)}
				title={keybinds.title(row.id, row.label)}
				data-shortcut-key
				onclick={() => keybinds.capture(listening(row.id) ? null : row.id)}
			>
				{listening(row.id) ? 'press a key…' : row.keys}
			</Button>
		</li>
	{/each}
	{#each keybinds.fixedRows as row (row.id)}
		<li class="reference">
			<span class="label">{row.label}</span>
			<Kbd keys={row.keys} />
		</li>
	{/each}
	{#if escLabel}
		<li class="reference">
			<span class="label">{escLabel}</span>
			<Kbd keys="Esc" />
		</li>
	{/if}
</ul>

<style>
	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		column-gap: var(--space-5);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-md);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.label {
		flex: 1;
		min-width: 0;
	}
	.inactive .label,
	.reference .label {
		color: var(--text-3);
	}
</style>
