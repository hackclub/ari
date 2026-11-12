<script lang="ts">
	import { Button, Icon } from '$lib/components/ui';
	import type { DockTileId } from '$lib/review/dockDefaults';
	import { holdToDrag } from '$lib/review/dockDom';
	import { keepKeysOnControl, moveTileWithKey } from '$lib/review/dockKeyboard';
	import type { DockState } from '$lib/review/dockState.svelte';
	import DockSizeMenu from './DockSizeMenu.svelte';
	import DockTabStrip from './DockTabStrip.svelte';

	interface Props {
		dock: DockState;
		tile: DockTileId;
		members: DockTileId[];
		active: DockTileId;
		collapsed: boolean;
		shortcutLabel?: (index: number) => string;
	}
	let { dock, tile, members, active, collapsed, shortcutLabel }: Props = $props();

	const showTablist = $derived(members.length > 1);
	const size = $derived(dock.sizeOf(tile));
	const resizing = $derived(dock.resizingTile === tile);
	const shortcut = $derived(shortcutLabel?.(dock.ordered.indexOf(active)));
	const icon = $derived(dock.tileInput(active)?.icon);
	const moveLabel = $derived(
		`Move ${dock.panelName(tile)}. Click to move it to the next position; use arrow keys to reposition; use Alt plus an arrow to group it with the adjacent tile.`
	);
</script>

<div
	class={{
		head: true,
		grabbing: dock.holdingTile === tile || dock.draggingTile === tile,
		pinned: dock.sizeMenuTile === tile || resizing
	}}
	data-dock-head
	title="Hold for 1 second to move · drop over another tile to group · drag grouped tabs to reorder or separate"
	use:holdToDrag={{ dock, tile }}
>
	{#if showTablist}
		<DockTabStrip {dock} anchor={tile} {members} {active} {shortcutLabel} />
		<span class="groupDragStrip" title="Hold for 1 second to move this group" aria-hidden="true"
		></span>
	{:else}
		{#if icon}<span class="icon"><Icon name={icon} size={15} /></span>{/if}
		<h3 id="evidence-{tile}-heading">{dock.label(active)}</h3>
	{/if}
	{#if collapsed}
		<span class="state">Collapsed</span>
	{:else if resizing}
		<span class="state">
			{dock.widthPercent(tile)}% · {size.height === null ? 'Fit' : `${size.height}px`}
		</span>
	{/if}
	{#if !showTablist && shortcut}
		<kbd title="{dock.label(active)} shortcut: {shortcut}">{shortcut}</kbd>
	{/if}
	<span class="actions">
		<span class="reveal">
			<Button
				variant="quiet"
				size="sm"
				icon="move"
				data-dock-control="move"
				aria-label={moveLabel}
				aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
				title="Move tile · hold its header and drop over another tile to group · Alt+Arrow groups with an adjacent tile"
				onkeydown={(event) => moveTileWithKey(dock, tile, event)}
				onclick={() => dock.moveNext(tile)}
			/>
		</span>
		<span class="reveal">
			<DockSizeMenu {dock} {tile} />
		</span>
		<span class={{ collapseControl: true, collapsed }}>
			<Button
				variant="quiet"
				size="sm"
				icon="chevD"
				data-dock-control="collapse"
				aria-label="{collapsed ? 'Expand' : 'Collapse'} {dock.panelName(tile)}"
				aria-expanded={!collapsed}
				title="{collapsed ? 'Expand' : 'Collapse'} panel"
				onkeydown={keepKeysOnControl}
				onclick={() => dock.toggleCollapsed(tile)}
			/>
		</span>
	</span>
</div>

<style>
	.head {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 42px;
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		cursor: grab;
		flex: 0 0 auto;
		touch-action: auto;
	}
	.head.grabbing {
		cursor: grabbing;
		user-select: none;
	}
	h3 {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: 750;
		color: var(--text);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.icon {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 25px;
		height: 25px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text-2);
	}
	.groupDragStrip {
		align-self: stretch;
		flex: 0 0 20px;
		min-width: 20px;
		margin-inline: -5px;
		cursor: grab;
		touch-action: none;
	}
	.state {
		flex: 0 0 auto;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-3);
	}
	kbd {
		margin-left: auto;
		padding: 0 var(--space-1);
		border: 1px solid var(--border-2);
		border-radius: var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.actions {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		flex: 0 0 auto;
		margin-left: auto;
	}
	kbd + .actions {
		margin-left: 0;
	}
	.reveal {
		display: inline-flex;
		transition:
			max-width 0.14s ease,
			opacity 0.14s ease,
			transform 0.14s ease;
	}
	.collapseControl {
		display: inline-flex;
	}
	.collapseControl :global(svg) {
		transition: transform 0.16s ease;
	}
	.collapseControl.collapsed :global(svg) {
		transform: rotate(-90deg);
	}
	@media (hover: hover) and (pointer: fine) {
		.actions {
			gap: 0;
		}
		/* clipped in both states: while the width animates the hidden buttons must not spill over the collapse
		   button and take its click; the 4px margin leaves room for the focus ring */
		.reveal {
			max-width: 0;
			overflow: clip;
			overflow-clip-margin: 4px;
			opacity: 0;
			transform: translateY(1px) scale(0.92);
		}
		.actions:hover,
		.actions:focus-within,
		.pinned .actions {
			gap: var(--space-1);
		}
		.actions:hover .reveal,
		.actions:focus-within .reveal,
		.pinned .reveal {
			max-width: 40px;
			opacity: 1;
			transform: none;
		}
	}
	@container evidenceTile (max-width: 560px) {
		.head {
			gap: 6px;
			padding-inline: 10px;
		}
		.state {
			display: none;
		}
	}
	@media (pointer: coarse) {
		.head {
			cursor: default;
		}
		/* 40px touch targets; the shared button stays 30px for a mouse */
		.actions :global(.button) {
			min-width: 40px;
			height: 40px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal,
		.collapseControl :global(svg) {
			transition: none;
		}
	}
</style>
