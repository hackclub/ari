<script lang="ts">
	import { pageCountFor, pageRange, pageWindow, tablePageSize } from '$lib/pagination';
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	interface Props {
		page?: number;
		pageCount?: number;
		total?: number;
		pageSize?: number;
		hrefFor?: (page: number) => string;
		onPageChange?: (page: number) => void;
		label?: string;
	}
	let {
		page = $bindable(0),
		pageCount,
		total,
		pageSize = tablePageSize(),
		hrefFor,
		onPageChange,
		label = 'Pagination'
	}: Props = $props();

	const pages = $derived(pageCount ?? pageCountFor(total ?? 0, pageSize));
	const current = $derived(Math.min(Math.max(page, 0), pages - 1));
	const range = $derived(total === undefined ? null : pageRange(current, pageSize, total));

	function goTo(target: number) {
		page = target;
		onPageChange?.(target);
	}
</script>

{#snippet step(target: number, icon: IconName, name: string)}
	{@const disabled = target < 0 || target >= pages}
	{#if hrefFor && !disabled}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor returns an already-resolved path -->
		<a class="control" href={hrefFor(target)} aria-label={name}><Icon name={icon} size={15} /></a>
	{:else if hrefFor}
		<span class="control disabled" role="link" aria-disabled="true" aria-label={name}>
			<Icon name={icon} size={15} />
		</span>
	{:else}
		<button type="button" class="control" aria-label={name} {disabled} onclick={() => goTo(target)}>
			<Icon name={icon} size={15} />
		</button>
	{/if}
{/snippet}

{#if pages > 1}
	<nav class="pagination" aria-label={label}>
		<p class="summary">
			{#if range && total !== undefined}
				Showing <b>{range.first}–{range.last}</b> of {total}
			{:else}
				Page <b>{current + 1}</b> of {pages}
			{/if}
		</p>
		<ul>
			<li>{@render step(current - 1, 'arrowL', 'Previous page')}</li>
			{#each pageWindow(current, pages) as entry, position (position)}
				<li>
					{#if entry === '…'}
						<span class="gap" aria-hidden="true">…</span>
					{:else if hrefFor}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefFor returns an already-resolved path -->
						<a
							class={['control', entry === current && 'current']}
							href={hrefFor(entry)}
							aria-label={`Page ${entry + 1}`}
							aria-current={entry === current ? 'page' : undefined}>{entry + 1}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{:else}
						<button
							type="button"
							class={['control', entry === current && 'current']}
							aria-label={`Page ${entry + 1}`}
							aria-current={entry === current ? 'page' : undefined}
							onclick={() => goTo(entry)}>{entry + 1}</button
						>
					{/if}
				</li>
			{/each}
			<li>{@render step(current + 1, 'arrowR', 'Next page')}</li>
		</ul>
	</nav>
{/if}

<style>
	.pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-2) var(--space-3);
	}
	.summary {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.summary b {
		color: var(--text);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.control {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--control-sm);
		height: var(--control-sm);
		padding: 0 var(--space-2);
		border: 1px solid var(--border-2);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s,
			border-color 0.12s;
	}
	.control:hover:not(:disabled, .disabled, .current) {
		background: var(--surface-3);
		color: var(--text);
	}
	.current {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--on-primary);
	}
	.control:disabled,
	.disabled {
		opacity: 0.45;
		cursor: default;
	}
	.gap {
		display: inline-flex;
		justify-content: center;
		min-width: var(--space-4);
		color: var(--text-3);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		.control {
			transition: none;
		}
	}
</style>
