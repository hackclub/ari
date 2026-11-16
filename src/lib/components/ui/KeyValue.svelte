<script lang="ts" module>
	export interface KeyValueItem {
		key: string;
		value: string;
		copy?: boolean;
		mono?: boolean;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { copyText } from '$lib/actions';
	import Button from './Button.svelte';

	interface Props {
		items: KeyValueItem[];
		layout?: 'inline' | 'stacked';
		value?: Snippet<[KeyValueItem]>;
	}
	let {
		items,
		layout = 'inline',
		value,
		...rest
	}: Props & HTMLAttributes<HTMLDListElement> = $props();
</script>

<dl class={['keyValue', layout]} {...rest}>
	{#each items as item, position (position)}
		<div class="pair">
			<dt>{item.key}</dt>
			<dd>
				<span class={['value', item.mono && 'mono']}>
					{#if value}{@render value(item)}{:else}{item.value}{/if}
				</span>
				{#if item.copy}
					<Button
						variant="quiet"
						size="sm"
						icon="clip"
						aria-label={`Copy ${item.key}`}
						onclick={() => copyText(item.value, `${item.key} copied`)}
					/>
				{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	.keyValue {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--text-sm);
	}
	.pair {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.inline .pair {
		display: grid;
		/* the label column is a third of the row, never under 96px (--space-7 * 2) */
		grid-template-columns: minmax(calc(var(--space-7) * 2), 1fr) minmax(0, 2fr);
		align-items: baseline;
		gap: var(--space-3);
	}
	dt {
		color: var(--text-3);
		font-weight: 500;
	}
	.stacked dt {
		font-size: var(--text-xs);
		font-weight: 600;
	}
	dd {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		margin: 0;
		color: var(--text);
	}
	.value {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.mono {
		font-family: var(--font-mono);
	}
</style>
