<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	interface Props {
		title: string;
		icon?: IconName;
		children?: Snippet;
		actions?: Snippet;
	}
	let { title, icon = 'inbox', children, actions }: Props = $props();
</script>

<div class="emptyState">
	<Icon name={icon} size={28} />
	<h3>{title}</h3>
	{#if children}<p>{@render children()}</p>{/if}
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.emptyState {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-7) var(--space-4);
		text-align: center;
		color: var(--text-3);
	}
	h3 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text);
	}
	p {
		margin: 0;
		max-width: 46ch;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
</style>
