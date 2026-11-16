<script lang="ts">
	import { Icon } from '$lib/components/ui';
	import type { DockTileId } from '$lib/review/dockDefaults';
	import { moveTabWithKey } from '$lib/review/dockKeyboard';
	import type { DockState } from '$lib/review/dockState.svelte';

	interface Props {
		dock: DockState;
		anchor: DockTileId;
		members: DockTileId[];
		active: DockTileId;
		shortcutLabel?: (index: number) => string;
	}
	let { dock, anchor, members, active, shortcutLabel }: Props = $props();

	const dragging = $derived(
		dock.draggingTab !== null && dock.groupMembers(anchor).includes(dock.draggingTab)
	);
	const helpId = $derived(`evidence-${anchor}-tab-drag-help`);
</script>

<span id={helpId} class="help">
	Drag to reorder this tab or drag it outside the tab strip to create a separate tile. On touch,
	hold before dragging. Alt, or Option on Mac, plus Left or Right reorders; Alt or Option plus Down
	separates.
</span>
<div
	class={{ tabs: true, detaching: dragging && dock.tabDetachReady }}
	role="tablist"
	aria-label="Grouped evidence"
	data-dock-tabstrip={anchor}
>
	{#each members as member (member)}
		{@const edge = dock.tabInsertionEdge(anchor, member)}
		{@const icon = dock.tileInput(member)?.icon}
		{@const shortcut = shortcutLabel?.(dock.ordered.indexOf(member))}
		<button
			type="button"
			id="evidence-{anchor}-tab-{member}"
			class={{
				tab: true,
				dragSource: dock.draggingTab === member,
				dropBefore: edge === 'before',
				dropAfter: edge === 'after'
			}}
			role="tab"
			aria-selected={active === member}
			aria-controls="evidence-{anchor}-panel-{member}"
			tabindex={active === member ? 0 : -1}
			title="{dock.label(member)} · drag to reorder · drag out to separate"
			aria-describedby={helpId}
			aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowDown"
			data-dock-tab={member}
			onpointerdown={(event) => dock.tabSession.start(anchor, member, event)}
			onlostpointercapture={dock.tabSession.lostCapture}
			onkeydown={(event) => moveTabWithKey(dock, anchor, member, event)}
			onclick={() => dock.tabSession.click(member)}
		>
			{#if icon}<Icon name={icon} size={13} />{/if}
			<span>{dock.name(member)}</span>
			{#if shortcut}<kbd title="{dock.label(member)} shortcut: {shortcut}">{shortcut}</kbd>{/if}
		</button>
	{/each}
</div>

<style>
	.help {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
	.tabs {
		display: flex;
		align-items: center;
		gap: 3px;
		flex: 1 1 auto;
		min-width: 0;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--surface) 76%, transparent);
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-inline: contain;
		scrollbar-width: none;
		transition:
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs.detaching {
		border-color: color-mix(in srgb, var(--color-blue) 62%, var(--border));
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-blue) 12%, transparent);
	}
	.tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		flex: 0 0 auto;
		min-width: 0;
		min-height: 25px;
		padding: 3px var(--space-2);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--text-xs);
		font-weight: 600;
		white-space: nowrap;
		cursor: grab;
		/* vertical swipes still scroll the page; sideways ones are ours to scroll the strip or drag */
		touch-action: pan-y;
		transition:
			background 0.14s ease,
			color 0.14s ease,
			opacity 0.14s ease;
	}
	.tab.dragSource {
		opacity: 0.28;
	}
	.tab.dropBefore::before,
	.tab.dropAfter::after {
		content: '';
		position: absolute;
		top: 3px;
		bottom: 3px;
		z-index: 2;
		width: 2px;
		border-radius: var(--radius-full);
		background: var(--color-blue);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-blue) 18%, transparent);
	}
	.tab.dropBefore::before {
		left: -2px;
	}
	.tab.dropAfter::after {
		right: -2px;
	}
	.tab:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.tab[aria-selected='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
	.tab:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-blue) 70%, transparent);
		outline-offset: -2px;
	}
	kbd {
		margin-left: 3px;
		padding: 0 var(--space-1);
		border: 1px solid var(--border-2);
		border-radius: var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	@media (pointer: coarse) {
		.tab {
			min-height: 40px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tabs,
		.tab {
			transition: none;
		}
	}
</style>
