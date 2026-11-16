<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		children: Snippet;
	}
	let { id, title, children }: Props = $props();
</script>

<section {id} class="docSection" data-doc-section>
	<h2>{title} <a href={`#${id}`} aria-label="Link to this section">#</a></h2>
	{@render children()}
</section>

<style>
	.docSection {
		margin-top: var(--space-6);
		padding-top: var(--space-6);
		border-top: 1px solid var(--doc-line-soft);
	}
	.docSection:first-of-type {
		margin-top: var(--space-7);
		padding-top: 0;
		border-top: 0;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-1);
		font-size: var(--text-xl);
		font-weight: 600;
		color: var(--text);
		scroll-margin-top: var(--space-5);
	}
	a {
		font-family: var(--font-mono);
		font-weight: 500;
		color: var(--primary);
		text-decoration: none;
		opacity: 0;
		transition: opacity 0.14s;
	}
	h2:hover a {
		opacity: 0.7;
	}
	a:hover,
	a:focus-visible {
		opacity: 1;
	}
</style>
