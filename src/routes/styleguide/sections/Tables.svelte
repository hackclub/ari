<script lang="ts">
	import { page as appPage } from '$app/state';
	import { formatDuration } from '$lib/time';
	import {
		Avatar,
		Badge,
		Button,
		Card,
		DataTable,
		EmptyState,
		Pagination,
		type BadgeTone,
		type DataTableColumn,
		type DataTableSort
	} from '$lib/components/ui';

	interface Ship {
		id: string;
		title: string;
		maker: string;
		track: string;
		status: BadgeTone;
		loggedSeconds: number;
	}

	const ships: Ship[] = [
		['ship-1041', 'Project 1', 'Maker 1', 'Hardware', 'pending', 45120],
		['ship-1042', 'Project 2', 'Maker 2', 'Web', 'approved', 28800],
		['ship-1043', 'Project 3', 'Maker 3', 'Games', 'changes', 61230],
		['ship-1044', 'Project 4', 'Maker 4', 'Web', 'pending', 19845],
		['ship-1045', 'Project 5', 'Maker 5', 'Hardware', 'secondpass', 90300],
		['ship-1046', 'Project 6', 'Maker 6', 'Web', 'rejected', 7260],
		['ship-1047', 'Project 7', 'Maker 7', 'Web', 'approved', 36610],
		['ship-1048', 'Project 8', 'Maker 8', 'Hardware', 'processing', 52200],
		['ship-1049', 'Project 9', 'Maker 9', 'Games', 'pending', 74415],
		['ship-1050', 'Project 10', 'Maker 10', 'Hardware', 'withdrawn', 3905],
		['ship-1051', 'Project 11', 'Maker 11', 'Web', 'fraudreview', 23400],
		['ship-1052', 'Project 12', 'Maker 12', 'Games', 'reverted', 41075]
	].map(([id, title, maker, track, status, loggedSeconds]) => ({
		id,
		title,
		maker,
		track,
		status,
		loggedSeconds
	})) as Ship[];

	const columns: DataTableColumn[] = [
		{ key: 'title', label: 'Project', width: '2.4fr', sortable: true },
		{ key: 'maker', label: 'Maker', width: '1.5fr', sortable: true, hideBelow: 'md' },
		{ key: 'track', label: 'Track', width: '110px', hideBelow: 'lg' },
		{ key: 'status', label: 'Status', width: '130px', sortable: true },
		{ key: 'loggedSeconds', label: 'Logged', width: '100px', align: 'end', sortable: true }
	];

	let sort = $state<DataTableSort | null>({ key: 'title', direction: 'asc' });
	let tablePage = $state(0);
	let loading = $state(false);
	let showEmpty = $state(false);
	let density = $state<'comfortable' | 'compact'>('comfortable');
	let lastAction = $state('');

	const sorted = $derived.by(() => {
		if (!sort) return ships;
		const key = sort.key as keyof Ship;
		const flip = sort.direction === 'asc' ? 1 : -1;
		return [...ships].sort((first, second) => {
			const left = first[key];
			const right = second[key];
			if (typeof left === 'number' && typeof right === 'number') return (left - right) * flip;
			return String(left).localeCompare(String(right)) * flip;
		});
	});
	// 5 rows a page so twelve ships give three pages
	const visible = $derived(showEmpty ? [] : sorted.slice(tablePage * 5, tablePage * 5 + 5));

	// the styleguide url carries a one-based ?page= for the link-driven pager
	const urlPage = $derived(Math.max(Number(appPage.url.searchParams.get('page') ?? 1) - 1, 0));
</script>

<h2>Tables</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>DataTable</h3>
			<div class="row">
				<Button size="sm" aria-pressed={loading} onclick={() => (loading = !loading)}>
					Loading
				</Button>
				<Button size="sm" aria-pressed={showEmpty} onclick={() => (showEmpty = !showEmpty)}>
					Empty
				</Button>
				<Button
					size="sm"
					aria-pressed={density === 'compact'}
					onclick={() => (density = density === 'compact' ? 'comfortable' : 'compact')}
				>
					Compact
				</Button>
				<span class="note" role="status">{lastAction}</span>
			</div>
			<DataTable
				label="Ships waiting for review"
				{columns}
				rows={visible}
				rowKey={(ship) => ship.id}
				rowHref={(ship) => `/styleguide?ship=${ship.id}`}
				rowLabel={(ship) => `Review ${ship.title}`}
				bind:sort
				onSortChange={() => (tablePage = 0)}
				{loading}
				loadingRows={5}
				{density}
				maxHeight="320px"
			>
				{#snippet cell({ row, column })}
					{#if column.key === 'title'}
						<div class="project">
							<span class="title">{row.title}</span>
							<span class="meta">{row.id}</span>
						</div>
					{:else if column.key === 'maker'}
						<Avatar name={row.maker} size="sm" decorative />
						<span class="maker">{row.maker}</span>
					{:else if column.key === 'status'}
						<Badge tone={row.status} dot>{row.status}</Badge>
					{:else if column.key === 'loggedSeconds'}
						<span class="mono">{formatDuration(row.loggedSeconds)}</span>
					{:else}
						{row.track}
					{/if}
				{/snippet}
				{#snippet rowActions(row)}
					<Button
						size="sm"
						variant="quiet"
						icon="refresh"
						onclick={() => (lastAction = `Resent ${row.id}`)}
					>
						Resend
					</Button>
				{/snippet}
				{#snippet empty()}
					<EmptyState title="No ships in this filter">
						Clear the filters to see everything that is waiting.
						{#snippet actions()}
							<Button variant="primary" onclick={() => (showEmpty = false)}>Clear filters</Button>
						{/snippet}
					</EmptyState>
				{/snippet}
			</DataTable>
			<Pagination bind:page={tablePage} total={showEmpty ? 0 : ships.length} pageSize={5} />
			<p class="note">
				Rows are links (try middle-click or Tab); the Resend button inside a row still works.
			</p>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>DataTable defaults</h3>
			<DataTable
				label="Tracks"
				density="compact"
				columns={[
					{ key: 'track', label: 'Track' },
					{ key: 'ships', label: 'Ships', align: 'end', width: '90px' }
				]}
				rows={[
					{ track: 'Hardware', ships: 4 },
					{ track: 'Web', ships: 5 },
					{ track: 'Games', ships: 3 }
				]}
				rowKey={(row) => row.track}
			/>
			<DataTable
				label="Archived ships"
				columns={[{ key: 'title', label: 'Project' }]}
				rows={[]}
				rowKey={() => 0}
			/>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Pagination</h3>
			<p class="note">Link-driven: each page is a real href, so it works without JavaScript.</p>
			<Pagination
				label="Link-driven pages"
				page={urlPage}
				total={470}
				hrefFor={(target) => `/styleguide?page=${target + 1}`}
			/>
			<p class="note">Controlled, with a page count instead of a total.</p>
			<Pagination label="Controlled pages" bind:page={tablePage} pageCount={3} />
		</div>
	</Card>
</div>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.project {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.title,
	.maker {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.maker {
		font-weight: 600;
	}
	.meta,
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
</style>
