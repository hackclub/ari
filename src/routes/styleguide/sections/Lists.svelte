<script lang="ts">
	import {
		Badge,
		Button,
		Card,
		Icon,
		KeyValue,
		List,
		ListRow,
		SortableList
	} from '$lib/components/ui';

	interface ChecklistItem {
		id: number;
		label: string;
	}

	let checklist = $state<ChecklistItem[]>([
		{ id: 1, label: 'Demo link opens and works' },
		{ id: 2, label: 'Repository is public' },
		{ id: 3, label: 'Logged hours match the commits' },
		{ id: 4, label: 'README explains how to run it' },
		{ id: 5, label: 'Screenshots show the real project' }
	]);
	let nextId = $state(6);
	let savedOrder = $state('');

	function addItem() {
		checklist = [...checklist, { id: nextId, label: 'New checklist item' }];
		nextId += 1;
	}

	const shipMeta = [
		{ key: 'Ship id', value: 'ship-1041', copy: true, mono: true },
		{ key: 'Repository', value: 'example.com/project1', copy: true },
		{ key: 'Track', value: 'Hardware' },
		{ key: 'Submitted', value: '3 October 2026, 14:20' }
	];
</script>

<h2>Lists</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>SortableList</h3>
			<p class="note">
				Drag the grip, or focus it and press Space, arrows, Space. The chevrons move one step.
			</p>
			<SortableList
				label="Approval checklist"
				bind:items={checklist}
				itemKey={(entry) => entry.id}
				itemLabel={(entry) => entry.label}
				onReorder={(ordered) => (savedOrder = ordered.map((entry) => entry.id).join(', '))}
			>
				{#snippet item({ item: entry, index, dragHandle, moveButtons })}
					{@render dragHandle()}
					<input
						class="labelInput"
						aria-label={`Checklist item ${index + 1}`}
						bind:value={checklist[index].label}
					/>
					{@render moveButtons()}
					<Button
						size="sm"
						variant="quiet"
						icon="x"
						aria-label={`Remove ${entry.label}`}
						onclick={() => (checklist = checklist.filter((other) => other.id !== entry.id))}
					/>
				{/snippet}
			</SortableList>
			<div class="row">
				<Button size="sm" icon="plus" onclick={addItem}>Add item</Button>
				<span class="note" role="status">{savedOrder ? `onReorder: ${savedOrder}` : ''}</span>
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>List and ListRow</h3>
			<List aria-label="Programs">
				<ListRow title="Program 1" meta="412 ships · 9 reviewers" href="/styleguide">
					{#snippet leading()}<Icon name="folder" />{/snippet}
					{#snippet actions()}
						<Badge tone="approved" dot>Open</Badge>
						<Button size="sm" variant="quiet" icon="settings">Settings</Button>
					{/snippet}
				</ListRow>
				<ListRow title="Program 2" meta="Archived 12 August 2026">
					{#snippet leading()}<Icon name="folder" />{/snippet}
					{#snippet actions()}<Button size="sm">Restore</Button>{/snippet}
				</ListRow>
				<ListRow title="Firefox on macOS" meta="Last active 4 minutes ago">
					{#snippet leading()}<Icon name="lock" />{/snippet}
					<Badge>This device</Badge>
				</ListRow>
			</List>
		</div>
	</Card>

	<Card>
		<div class="columns">
			<div class="stack">
				<h3>KeyValue inline</h3>
				<KeyValue items={shipMeta} />
			</div>
			<div class="stack">
				<h3>KeyValue stacked, custom value</h3>
				<KeyValue items={shipMeta.slice(1, 3)} layout="stacked">
					{#snippet value(pair)}
						{#if pair.key === 'Track'}<Badge tone="secondpass">{pair.value}</Badge
							>{:else}{pair.value}{/if}
					{/snippet}
				</KeyValue>
			</div>
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
		min-width: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.labelInput {
		flex: 1;
		min-width: 0;
		height: var(--control-sm);
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
	}
	.labelInput:hover,
	.labelInput:focus {
		border-color: var(--border-2);
		background: var(--surface-2);
	}
</style>
