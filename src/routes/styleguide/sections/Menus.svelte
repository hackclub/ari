<script lang="ts">
	import {
		Button,
		Card,
		Dropdown,
		Icon,
		Kbd,
		MultiFilter,
		Tooltip,
		type DropdownItem
	} from '$lib/components/ui';

	let lastAction = $state('Nothing selected yet.');
	let sortBy = $state('Newest');
	let statuses = $state<string[]>(['pending']);

	const actions: DropdownItem[] = [
		{ label: 'Open ship', icon: 'external', onSelect: () => (lastAction = 'Open ship') },
		{ label: 'Copy link', icon: 'link', onSelect: () => (lastAction = 'Copy link') },
		{ label: 'Styleguide', icon: 'book', href: '/styleguide' },
		{ label: 'Reassign', icon: 'user', disabled: true },
		{
			label: 'Delete',
			icon: 'x',
			tone: 'danger',
			separatorBefore: true,
			onSelect: () => (lastAction = 'Delete')
		}
	];
	const sortItems = $derived<DropdownItem[]>(
		['Newest', 'Oldest', 'Most hours'].map((label) => ({
			label,
			selected: sortBy === label,
			onSelect: () => (sortBy = label)
		}))
	);
	const programItems: DropdownItem[] = [
		{ label: 'Program 1', color: 'var(--color-blue)', selected: true },
		{ label: 'Program 2', color: 'var(--color-orange)', detail: '12' },
		{ label: 'Browse all', icon: 'layers', separatorBefore: true }
	];
	const statusOptions = [
		{ value: 'pending', label: 'Pending', color: 'var(--status-pending)' },
		{ value: 'approved', label: 'Approved', color: 'var(--status-approved)' },
		{ value: 'rejected', label: 'Rejected', color: 'var(--status-rejected)' }
	];
</script>

<h2>Menus</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>Dropdown</h3>
			<div class="row">
				<Dropdown label="Actions" items={actions} />
				<Dropdown label="Sort: {sortBy}" icon="sort" items={sortItems} />
				<Dropdown label="Opens upward" side="top" align="end" variant="soft" items={actions} />
				<Dropdown items={actions} align="end">
					{#snippet trigger(triggerProps)}
						<Button variant="quiet" icon="dots" aria-label="More actions" {...triggerProps} />
					{/snippet}
				</Dropdown>
				<Dropdown label="Rich items" items={programItems}>
					{#snippet header()}
						<p class="heading">Your programs</p>
					{/snippet}
				</Dropdown>
				<Dropdown label="Custom content">
					{#snippet children(close)}
						<div class="custom">
							<p>Anything can go in the panel.</p>
							<Button size="sm" onclick={close}>Done</Button>
						</div>
					{/snippet}
				</Dropdown>
			</div>
			<p>{lastAction}</p>
		</div>
	</Card>
	<Card>
		<div class="stack">
			<h3>MultiFilter</h3>
			<div class="row">
				<MultiFilter label="Status" options={statusOptions} bind:selected={statuses} />
			</div>
			<p>Selected: {statuses.join(', ') || 'all'}</p>
		</div>
	</Card>
	<Card>
		<div class="stack">
			<h3>Tooltip</h3>
			<div class="row">
				<Tooltip text="Opens the ship in a new tab">
					<Button icon="external">Hover or focus</Button>
				</Tooltip>
				<Tooltip text="Shown below the control" side="bottom">
					<Button variant="quiet" aria-label="Information"><Icon name="info" size={16} /></Button>
				</Tooltip>
				<Tooltip text="You cannot approve your own ship">
					<Button variant="ok" aria-disabled="true">Approve</Button>
				</Tooltip>
			</div>
		</div>
	</Card>
	<Card>
		<div class="stack">
			<h3>Kbd</h3>
			<div class="row">
				<Kbd keys="j" />
				<Kbd keys="⌘↵" title="Approve shortcut: ⌘↵" />
				<Kbd keys="Ctrl+⇧+K" />
				<Button size="sm" icon="arrowR">Next <Kbd keys="j" /></Button>
			</div>
		</div>
	</Card>
</div>

<style>
	.heading {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-3);
	}
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
	p {
		margin: 0;
		font-size: var(--text-sm);
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
	.custom {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-2);
	}
</style>
