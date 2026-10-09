<script lang="ts" module>
	export interface DataTableColumn {
		key: string;
		label: string;
		width?: string;
		minWidth?: string;
		align?: 'start' | 'center' | 'end';
		sortable?: boolean;
		hideBelow?: 'sm' | 'md' | 'lg';
	}
	export interface DataTableSort {
		key: string;
		direction: 'asc' | 'desc';
	}
</script>

<script lang="ts" generics="Row extends object">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';
	import Skeleton from './Skeleton.svelte';

	interface Props {
		columns: DataTableColumn[];
		rows: Row[];
		rowKey: (row: Row) => string | number;
		label: string;
		cell?: Snippet<[{ row: Row; column: DataTableColumn; index: number }]>;
		rowHref?: (row: Row) => string | undefined;
		rowLabel?: (row: Row) => string;
		rowActions?: Snippet<[Row]>;
		sort?: DataTableSort | null;
		onSortChange?: (sort: DataTableSort) => void;
		loading?: boolean;
		loadingRows?: number;
		empty?: Snippet;
		emptyTitle?: string;
		density?: 'comfortable' | 'compact';
		stickyHeader?: boolean;
		maxHeight?: string;
		flush?: boolean;
	}
	let {
		columns,
		rows,
		rowKey,
		label,
		cell,
		rowHref,
		rowLabel,
		rowActions,
		sort = $bindable(null),
		onSortChange,
		loading = false,
		loadingRows = 6,
		empty,
		emptyTitle = 'Nothing here yet',
		density = 'comfortable',
		stickyHeader = true,
		maxHeight,
		flush = false,
		...rest
	}: Props & HTMLTableAttributes = $props();

	const hideClass = { sm: 'hideBelowSm', md: 'hideBelowMd', lg: 'hideBelowLg' };

	function trackFor(column: DataTableColumn): string {
		const width = column.width ?? '1fr';
		if (!/^[\d.]+fr$/.test(width)) return width;
		// a flexible track needs a floor or fixed columns crush it; 144px (--space-7 * 3) keeps a title
		// readable, and when the floors do not fit the scroller scrolls sideways instead
		return `minmax(${column.minWidth ?? 'calc(var(--space-7) * 3)'}, ${width})`;
	}

	function templateFor(hidden: string[]): string {
		const tracks = columns
			.filter((column) => !column.hideBelow || !hidden.includes(column.hideBelow))
			.map(trackFor);
		if (rowActions) tracks.push('max-content');
		return tracks.join(' ');
	}

	const columnCount = $derived(columns.length + (rowActions ? 1 : 0));
	const linkColumn = $derived(columns.find((column) => !column.hideBelow)?.key ?? columns[0]?.key);

	const textFor = (row: Row, key: string): string => {
		const value = (row as Record<string, unknown>)[key];
		return value === null || value === undefined ? '' : String(value);
	};

	function ariaSortFor(column: DataTableColumn) {
		if (!column.sortable) return undefined;
		if (sort?.key !== column.key) return 'none';
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}

	function toggleSort(key: string) {
		const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
		sort = { key, direction };
		onSortChange?.(sort);
	}

	const cellClasses = (column: DataTableColumn) => [
		'cell',
		column.align ?? 'start',
		column.hideBelow && hideClass[column.hideBelow]
	];
</script>

<!-- eslint-disable svelte/no-inline-styles -- the one place column tracks and the scroll height are data-driven -->
<div
	class={['scroller', flush && 'flush', maxHeight && 'limited']}
	style:max-height={maxHeight}
	style:--columns-wide={templateFor([])}
	style:--columns-below-lg={templateFor(['lg'])}
	style:--columns-below-md={templateFor(['lg', 'md'])}
	style:--columns-below-sm={templateFor(['lg', 'md', 'sm'])}
>
	<!-- eslint-enable svelte/no-inline-styles -->
	<table class={['table', density]} aria-label={label} aria-busy={loading} {...rest}>
		<thead>
			<tr class={['headRow', stickyHeader && 'sticky']}>
				{#each columns as column (column.key)}
					<th scope="col" class={cellClasses(column)} aria-sort={ariaSortFor(column)}>
						{#if column.sortable}
							<button type="button" class="sortButton" onclick={() => toggleSort(column.key)}>
								{column.label}
								<span
									class={[
										'sortIcon',
										sort?.key === column.key && 'active',
										sort?.key === column.key && sort.direction === 'asc' && 'ascending'
									]}
								>
									<Icon name={sort?.key === column.key ? 'chevD' : 'sort'} size={13} />
								</span>
							</button>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
				{#if rowActions}
					<th scope="col" class="cell end"><span class="visuallyHidden">Actions</span></th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#if loading}
				{#each { length: loadingRows }, rowIndex (rowIndex)}
					<tr class="row">
						{#each columns as column, columnIndex (column.key)}
							<td class={cellClasses(column)}>
								<!-- widths cycle between 45% and 85% so the rows do not look like a solid block -->
								<Skeleton width={`${45 + ((rowIndex * 17 + columnIndex * 11) % 41)}%`} />
							</td>
						{/each}
						{#if rowActions}<td class="cell end"></td>{/if}
					</tr>
				{/each}
			{:else}
				{#each rows as row, index (rowKey(row))}
					{@const href = rowHref?.(row)}
					<tr class={['row', href && 'linked']}>
						{#each columns as column (column.key)}
							<td class={cellClasses(column)}>
								{#if href && column.key === linkColumn}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass an already-resolved path -->
									<a class="rowLink" {href} aria-label={rowLabel?.(row) ?? textFor(row, column.key)}
									></a>
								{/if}
								{#if cell}
									{@render cell({ row, column, index })}
								{:else}
									<span class="truncate">{textFor(row, column.key)}</span>
								{/if}
							</td>
						{/each}
						{#if rowActions}
							<td class="cell end actions">{@render rowActions(row)}</td>
						{/if}
					</tr>
				{:else}
					<tr class="emptyRow">
						<td colspan={columnCount}>
							{#if empty}{@render empty()}{:else}<EmptyState title={emptyTitle} />{/if}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
	{#if loading}<span class="visuallyHidden" role="status">Loading {label}</span>{/if}
</div>

<style>
	.scroller {
		container-type: inline-size;
		overflow: auto;
		overscroll-behavior-x: contain;
		overscroll-behavior-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	/* only a capped table scrolls inward, so only it contains vertical scroll */
	.limited {
		overscroll-behavior-y: contain;
	}
	.flush {
		border: 0;
		border-radius: 0;
		box-shadow: none;
	}
	.table {
		display: grid;
		grid-template-columns: var(--columns-wide);
		width: 100%;
		margin: 0;
		border-spacing: 0;
		font-size: var(--text-sm);
	}
	thead,
	tbody {
		display: contents;
	}
	tr {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
	}
	.row {
		position: relative;
		border-bottom: 1px solid var(--border);
		transition: background 0.12s;
	}
	.row:last-child {
		border-bottom: 0;
	}
	.linked:hover,
	.linked:has(.rowLink:focus-visible) {
		background: var(--surface-2);
	}
	.headRow {
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
	}
	.sticky {
		position: sticky;
		top: 0;
		z-index: var(--layer-sticky);
	}
	.cell {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		text-align: start;
	}
	.compact .cell {
		padding: var(--space-1) var(--space-3);
	}
	th.cell {
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.01em;
		color: var(--text-3);
		white-space: nowrap;
	}
	.center {
		justify-content: center;
		text-align: center;
	}
	.end {
		justify-content: flex-end;
		text-align: end;
	}
	.truncate {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sortButton {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		font: inherit;
		letter-spacing: inherit;
		color: inherit;
		cursor: pointer;
	}
	.sortButton:hover {
		color: var(--text);
	}
	.sortIcon {
		display: inline-flex;
		opacity: 0.6;
		transition: transform 0.15s;
	}
	.sortIcon.active {
		opacity: 1;
		color: var(--primary);
	}
	.sortIcon.ascending {
		transform: rotate(180deg);
	}
	.rowLink {
		position: absolute;
		inset: 0;
	}
	.rowLink:focus-visible {
		box-shadow: inset 0 0 0 3px var(--ring);
	}
	/* anything interactive in a cell sits above the row link so it stays clickable */
	.cell :global(:is(a, button, input, select, textarea, label, summary):not(.rowLink)) {
		position: relative;
	}
	.emptyRow {
		display: block;
	}
	.emptyRow td {
		display: block;
		padding: 0;
	}
	.visuallyHidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* container widths at which lg, md and sm columns drop out */
	@container (width < 880px) {
		.table {
			grid-template-columns: var(--columns-below-lg);
		}
		.hideBelowLg {
			display: none;
		}
	}
	@container (width < 640px) {
		.table {
			grid-template-columns: var(--columns-below-md);
		}
		.hideBelowMd {
			display: none;
		}
	}
	@container (width < 440px) {
		.table {
			grid-template-columns: var(--columns-below-sm);
		}
		.hideBelowSm {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.row,
		.sortIcon {
			transition: none;
		}
	}
</style>
