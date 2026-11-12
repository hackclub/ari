<script lang="ts" module>
	export interface MultiFilterOption {
		value: string;
		label: string;
		color?: string;
	}
</script>

<script lang="ts">
	import Button from './Button.svelte';
	import Checkbox from './Checkbox.svelte';
	import Popover from './Popover.svelte';
	import Swatch from './Swatch.svelte';
	import type { IconName } from './iconPaths';

	interface Props {
		label: string;
		icon?: IconName;
		options: MultiFilterOption[];
		selected?: string[];
		align?: 'start' | 'end';
	}
	let {
		label,
		icon = 'filter',
		options,
		selected = $bindable([]),
		align = 'start'
	}: Props = $props();

	const uid = $props.id();
	let open = $state(false);
	let listElement = $state<HTMLDivElement>();

	function toggle(value: string) {
		selected = selected.includes(value)
			? selected.filter((entry) => entry !== value)
			: [...selected, value];
	}
</script>

<Popover
	bind:open
	{align}
	id="{uid}-panel"
	role="group"
	aria-label={label}
	onOpen={() => listElement?.querySelector('input')?.focus()}
>
	{#snippet anchor()}
		<Button
			{icon}
			iconAfter="chevD"
			aria-expanded={open}
			aria-controls="{uid}-panel"
			onclick={() => (open = !open)}
		>
			{label}
			{#if selected.length}
				<span class="count">{selected.length}<span class="hidden"> selected</span></span>
			{/if}
		</Button>
	{/snippet}
	<div class="multiFilter" bind:this={listElement}>
		{#each options as option (option.value)}
			<div class="option">
				<Checkbox checked={selected.includes(option.value)} onchange={() => toggle(option.value)}>
					<span class="optionLabel">
						{#if option.color}<Swatch color={option.color} size="sm" />{/if}
						{option.label}
					</span>
				</Checkbox>
			</div>
		{/each}
		<div class="footer">
			<Button
				variant="quiet"
				size="sm"
				disabled={selected.length === 0}
				onclick={() => (selected = [])}
			>
				Clear
			</Button>
		</div>
	</div>
</Popover>

<style>
	.count {
		display: inline-grid;
		place-items: center;
		min-width: var(--space-4);
		height: var(--space-4);
		padding: 0 var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--primary);
		color: var(--on-primary);
		font-size: var(--text-xs);
	}
	.hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.multiFilter {
		display: flex;
		flex-direction: column;
		min-width: 210px;
		padding: var(--space-1);
	}
	.option {
		display: flex;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
	}
	.option:hover {
		background: var(--surface-3);
	}
	.option > :global(label) {
		flex: 1;
	}
	.optionLabel {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-1);
		padding: var(--space-1) var(--space-1) 0;
		border-top: 1px solid var(--border);
	}
</style>
