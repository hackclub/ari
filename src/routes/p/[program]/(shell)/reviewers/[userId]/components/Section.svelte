<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Card, Icon, type IconName } from '$lib/components/ui';

	interface Props {
		title: string;
		icon: IconName;
		detail?: string;
		flush?: boolean;
		children: Snippet;
	}
	let { title, icon, detail, flush = false, children }: Props = $props();
</script>

<Card padded={false}>
	<section class="section">
		<header class="head">
			<Icon name={icon} size={15} />
			<h2>{title}</h2>
			{#if detail}<span class="detail">{detail}</span>{/if}
		</header>
		<div class={['body', flush && 'flush']}>{@render children()}</div>
	</section>
</Card>

<style>
	.section {
		min-width: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--border);
		color: var(--text-2);
	}
	h2 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);
	}
	.detail {
		margin-left: auto;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-2);
	}
	.body {
		padding: var(--space-4);
	}
	.flush {
		padding: 0;
	}
</style>
