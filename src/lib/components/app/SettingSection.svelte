<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		intro?: Snippet;
		children: Snippet;
	}
	let { title, description, intro, children }: Props = $props();
</script>

<section class="settingSection">
	<div class="intro">
		<h2>{title}</h2>
		{#if description}<p>{description}</p>{/if}
		{@render intro?.()}
	</div>
	<div class="body">{@render children()}</div>
</section>

<style>
	.settingSection {
		display: grid;
		grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
		gap: var(--space-5);
		padding: var(--space-5) 0;
		border-bottom: 1px solid var(--border);
	}
	.settingSection:last-child {
		border-bottom: 0;
	}
	h2 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
	}
	.intro :global(p) {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	@media (max-width: 760px) {
		.settingSection {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-3);
		}
	}
</style>
