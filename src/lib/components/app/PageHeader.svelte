<script lang="ts" generics="TabValue extends string">
	import type { ComponentProps, Snippet } from 'svelte';
	import { Tabs } from '$lib/components/ui';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
		tabs?: ComponentProps<typeof Tabs<TabValue>>['tabs'];
		tab?: TabValue;
		tabsLabel?: string;
		onTabChange?: (value: TabValue) => void;
		children?: Snippet;
	}
	let {
		title,
		description,
		actions,
		tabs,
		tab = $bindable(),
		tabsLabel,
		onTabChange,
		children
	}: Props = $props();
</script>

<header class="pageHeader">
	<div class="row">
		<div class="copy">
			<h1>{title}</h1>
			{#if description}<p>{description}</p>{/if}
			{@render children?.()}
		</div>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
	{#if tabs?.length && tab !== undefined}
		<Tabs {tabs} bind:value={tab} label={tabsLabel ?? title} onchange={onTabChange} />
	{/if}
</header>

<style>
	.pageHeader {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.copy {
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 600;
		line-height: 1.2;
	}
	p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
