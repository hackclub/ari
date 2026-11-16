<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLiAttributes } from 'svelte/elements';

	interface Props {
		title: string;
		meta?: string;
		href?: string;
		leading?: Snippet;
		children?: Snippet;
		actions?: Snippet;
	}
	let { title, meta, href, leading, children, actions, ...rest }: Props & HTMLLiAttributes =
		$props();
</script>

<li class={['listRow', href && 'linked']} {...rest}>
	{#if leading}<div class="leading">{@render leading()}</div>{/if}
	<div class="body">
		{#if href}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass an already-resolved path or an external url -->
			<a class="title rowLink" {href}>{title}</a>
		{:else}
			<span class="title">{title}</span>
		{/if}
		{#if meta || children}
			<div class="meta">
				{#if meta}<span>{meta}</span>{/if}
				{@render children?.()}
			</div>
		{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</li>

<style>
	.listRow {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-bottom: 1px solid var(--border);
		transition: background 0.12s;
	}
	.listRow:last-child {
		border-bottom: 0;
	}
	.linked:hover,
	.linked:has(.rowLink:focus-visible) {
		background: var(--surface-2);
	}
	.leading {
		display: flex;
		flex: none;
		align-items: center;
		color: var(--text-3);
	}
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.title {
		overflow: hidden;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.rowLink:focus-visible {
		box-shadow: none;
	}
	.rowLink::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.rowLink:focus-visible::after {
		box-shadow: inset 0 0 0 3px var(--ring);
	}
	/* controls in the row sit above the stretched title link so they stay clickable */
	.actions,
	.meta :global(:is(a, button)),
	.leading :global(:is(a, button)) {
		position: relative;
	}
	.actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--space-2);
	}
	@media (prefers-reduced-motion: reduce) {
		.listRow {
			transition: none;
		}
	}
</style>
