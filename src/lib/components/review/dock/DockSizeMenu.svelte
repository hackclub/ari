<script lang="ts">
	import { tick } from 'svelte';
	import { Button, Dropdown, RangeField, SegmentedControl } from '$lib/components/ui';
	import type { DockTileId } from '$lib/review/dockDefaults';
	import { containEvents } from '$lib/review/dockDom';
	import { keepKeysOnControl } from '$lib/review/dockKeyboard';
	import { alignmentColumn, placementOptions, type DockAlignment } from '$lib/review/dockLayout';
	import type { DockState } from '$lib/review/dockState.svelte';

	interface Props {
		dock: DockState;
		tile: DockTileId;
	}
	let { dock, tile }: Props = $props();

	let content = $state<HTMLDivElement>();

	const size = $derived(dock.sizeOf(tile));
	const options = $derived(placementOptions(dock.layout, tile));
	const alignment = $derived<DockAlignment | 'none'>(
		options.find((option) => alignmentColumn(dock.layout, tile, option.alignment) === size.column)
			?.alignment ?? 'none'
	);

	$effect(() => {
		if (!content) return;
		void tick().then(() =>
			content?.querySelector<HTMLInputElement>('input[type="range"]')?.focus()
		);
	});
</script>

<Dropdown
	align="end"
	bind:open={() => dock.sizeMenuTile === tile, (open) => dock.setSizeMenu(tile, open)}
>
	{#snippet trigger(triggerProps)}
		<Button
			variant="quiet"
			size="sm"
			icon="crop"
			data-dock-control="size"
			aria-label="Size {dock.panelName(tile)}. Current size: {dock.sizeDescription(tile)}."
			title="Set tile width and height"
			{...triggerProps}
			onkeydown={(event) => {
				keepKeysOnControl(event);
				triggerProps.onkeydown(event);
			}}
		/>
	{/snippet}
	<div
		class="controls"
		role="group"
		aria-label="{dock.panelName(tile)} size"
		bind:this={content}
		use:containEvents
	>
		<RangeField
			label={dock.stacked ? 'Desktop width' : 'Width'}
			min={4}
			max={12}
			value={size.columns}
			valueLabel="{size.columns}/12 · {dock.widthPercent(tile)}%"
			valueText="{dock.widthPercent(tile)} percent"
			onValue={(columns) => dock.setColumns(tile, columns)}
			onCommit={() => dock.announceSize(tile)}
		/>
		<RangeField
			label="Height"
			min={220}
			max={900}
			step={10}
			value={dock.heightControlValue(tile)}
			valueLabel={size.height === null ? 'Fit content' : `${size.height}px`}
			valueText={size.height === null ? 'Fit content' : `${size.height} pixels`}
			onValue={(height) => dock.setHeight(tile, height)}
			onCommit={() => dock.announceSize(tile)}
		/>
		<div class="placement">
			<span>{dock.stacked ? 'Desktop position' : 'Position'}</span>
			{#if options.length}
				<SegmentedControl
					size="sm"
					label="{dock.panelName(tile)} {dock.stacked ? 'desktop ' : ''}horizontal position"
					value={alignment}
					options={options.map((option) => ({ value: option.alignment, label: option.label }))}
					onchange={(value) => {
						if (value !== 'none') dock.align(tile, value);
					}}
				/>
			{:else}
				<span class="staticNote">Uses all columns</span>
			{/if}
		</div>
		<div class="buttons">
			<Button
				size="sm"
				disabled={size.height === null}
				onclick={() => dock.setHeight(tile, null, true)}
			>
				Fit height
			</Button>
			<Button size="sm" icon="refresh" onclick={() => dock.resetSize(tile)}>Reset</Button>
		</div>
	</div>
</Dropdown>

<style>
	.controls {
		display: grid;
		gap: var(--space-3);
		width: min(280px, calc(100vw - var(--space-6)));
		padding: var(--space-3);
	}
	.placement {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-2);
	}
	.staticNote {
		font-weight: 600;
		color: var(--text-3);
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
	}
</style>
