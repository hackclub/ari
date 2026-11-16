<script lang="ts">
	import { Icon } from '$lib/components/ui';
	import type { DockTileId } from '$lib/review/dockDefaults';
	import { styleVariables } from '$lib/review/dockDom';
	import type { DockState } from '$lib/review/dockState.svelte';

	interface Props {
		dock: DockState;
		tile: DockTileId;
	}
	let { dock, tile }: Props = $props();

	const icon = $derived(dock.tileInput(tile)?.icon);
</script>

<div
	class={{ ghost: true, detaching: dock.tabDetachReady }}
	aria-hidden="true"
	use:styleVariables={{
		'tab-drag-left': `${dock.tabDragPosition.left}px`,
		'tab-drag-top': `${dock.tabDragPosition.top}px`,
		'tab-drag-width': `${dock.tabDragPosition.width}px`,
		'tab-drag-height': `${dock.tabDragPosition.height}px`
	}}
>
	{#if icon}<Icon name={icon} size={13} />{/if}
	<span>{dock.name(tile)}</span>
</div>

<style>
	.ghost {
		position: fixed;
		left: var(--tab-drag-left);
		top: var(--tab-drag-top);
		z-index: 110;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		width: var(--tab-drag-width);
		height: var(--tab-drag-height);
		padding: 3px var(--space-2);
		border: 1px solid color-mix(in srgb, var(--color-blue) 36%, var(--border));
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-lg);
		font-size: var(--text-xs);
		font-weight: 600;
		white-space: nowrap;
		pointer-events: none;
		transform: scale(1.03);
		transform-origin: center;
		transition:
			border-color 0.16s ease,
			box-shadow 0.16s ease,
			transform 0.16s ease;
	}
	.detaching {
		border-color: var(--color-blue);
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--color-blue) 18%, transparent),
			var(--shadow-lg);
		transform: rotate(1.5deg) scale(1.06);
	}
	@media (prefers-reduced-motion: reduce) {
		.ghost {
			transition: none;
		}
	}
</style>
