<script lang="ts" generics="Value extends string">
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	interface TabItem {
		value: Value;
		label: string;
		icon?: IconName;
		count?: number;
		href?: string;
	}
	interface Props {
		tabs: TabItem[];
		value: Value;
		label: string;
		panelId?: string;
		onchange?: (value: Value) => void;
	}
	let { tabs, value = $bindable(), label, panelId, onchange }: Props = $props();

	const uid = $props.id();
	const focusableValue = $derived(tabs.some((tab) => tab.value === value) ? value : tabs[0]?.value);

	function select(tab: TabItem) {
		if (tab.value === value) return;
		value = tab.value;
		onchange?.(tab.value);
	}

	function onKeydown(event: KeyboardEvent, index: number) {
		const lastIndex = tabs.length - 1;
		const targetIndex = {
			ArrowRight: index === lastIndex ? 0 : index + 1,
			ArrowLeft: index === 0 ? lastIndex : index - 1,
			Home: 0,
			End: lastIndex
		}[event.key];
		if (targetIndex === undefined) return;
		event.preventDefault();
		const target = tabs[targetIndex];
		document.getElementById(`${uid}-${target.value}`)?.focus();
		// link tabs only move focus: following one is a navigation the user confirms with enter
		if (!target.href) select(target);
	}
</script>

{#snippet content(tab: TabItem)}
	{#if tab.icon}<Icon name={tab.icon} size={15} />{/if}
	{tab.label}
	{#if tab.count !== undefined}<span class="count">{tab.count}</span>{/if}
{/snippet}

<div class="tabs" role="tablist" aria-label={label}>
	{#each tabs as tab, index (tab.value)}
		{@const selected = tab.value === value}
		{#if tab.href}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass an already-resolved path -->
			<a
				href={tab.href}
				id="{uid}-{tab.value}"
				class={{ tab: true, selected }}
				role="tab"
				aria-selected={selected}
				aria-controls={panelId}
				tabindex={tab.value === focusableValue ? 0 : -1}
				onkeydown={(event) => onKeydown(event, index)}
			>
				{@render content(tab)}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<button
				type="button"
				id="{uid}-{tab.value}"
				class={{ tab: true, selected }}
				role="tab"
				aria-selected={selected}
				aria-controls={panelId}
				tabindex={tab.value === focusableValue ? 0 : -1}
				onclick={() => select(tab)}
				onkeydown={(event) => onKeydown(event, index)}
			>
				{@render content(tab)}
			</button>
		{/if}
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: var(--space-1);
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		/* each tab's -1px margin overlaps the border and would otherwise scroll vertically */
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex: none;
		margin-bottom: -1px;
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-bottom: 2px solid transparent;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: none;
		color: var(--text-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 500;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab:focus-visible {
		/* inset so the scrolling tab bar does not clip the ring */
		box-shadow: inset 0 0 0 3px var(--ring);
	}
	.selected {
		color: var(--text);
		border-bottom-color: var(--primary);
	}
	.count {
		padding: 2px var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text-2);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.tab {
			transition: none;
		}
	}
</style>
