<script lang="ts">
	import { Badge, Button, EmptyState, Icon, SortableList, type IconName } from '$lib/components/ui';
	import { fieldTypeLabel, type FieldDraft, type FieldType } from '$lib/settingsRules';
	import type { SettingsForm } from '../settingsForm.svelte';
	import { tracksLabel } from '../settingsLabels';
	import FieldDialog from './FieldDialog.svelte';
	import SettingSection from '$lib/components/app/SettingSection.svelte';

	let { form }: { form: SettingsForm } = $props();

	const typeIcons: Record<FieldType, IconName> = {
		checkbox: 'checkCircle',
		text: 'book',
		number: 'chart',
		select: 'layers',
		multiselect: 'grid'
	};

	let dialogOpen = $state(false);
	let editing = $state<FieldDraft | null>(null);

	const takenKeys = $derived(
		form.tools.fields.filter((field) => field.id !== editing?.id).map((field) => field.key)
	);

	function openDialog(field: FieldDraft | null) {
		editing = field;
		dialogOpen = true;
	}

	function save(draft: Omit<FieldDraft, 'id'>) {
		const editId = editing?.id;
		form.tools.fields = editId
			? form.tools.fields.map((field) => (field.id === editId ? { ...draft, id: editId } : field))
			: [...form.tools.fields, { ...draft, id: form.newId() }];
	}

	function remove(id: string) {
		form.tools.fields = form.tools.fields.filter((field) => field.id !== id);
	}
</script>

<SettingSection
	title="Custom review fields"
	description="Extra inputs reviewers fill in on each submission. The value name is what the answer is labeled as in the review results."
>
	{#if form.tools.fields.length}
		<SortableList
			label="Custom review fields"
			bind:items={() => form.tools.fields, (next) => (form.tools.fields = next)}
			itemKey={(field) => field.id}
			itemLabel={(field) => field.label}
		>
			{#snippet item({ item: field, dragHandle, moveButtons })}
				{@render dragHandle()}
				<div class="rowContent">
					<span class="typeIcon"><Icon name={typeIcons[field.type]} size={16} /></span>
					<div class="summary">
						<span class="label">{field.label}</span>
						{#if field.description}<span class="description">{field.description}</span>{/if}
						<span class="facts">
							<code>{field.key}</code>
							<span
								>{[fieldTypeLabel(field.type), field.options.join(', ')]
									.filter(Boolean)
									.join(' · ')}</span
							>
							{#if field.required}<Badge tone="rejected">Required</Badge>{/if}
							<Badge>{tracksLabel(field.tracks)}</Badge>
						</span>
					</div>
					<div class="controls">
						{@render moveButtons()}
						<Button
							size="sm"
							variant="quiet"
							aria-label={`Edit ${field.label}`}
							onclick={() => openDialog(field)}
						>
							Edit
						</Button>
						<Button
							size="sm"
							variant="quiet"
							icon="x"
							aria-label={`Remove ${field.label}`}
							onclick={() => remove(field.id)}
						/>
					</div>
				</div>
			{/snippet}
		</SortableList>
	{:else}
		<EmptyState title="No custom fields yet" icon="layers">
			Add a field to collect something extra with every review.
		</EmptyState>
	{/if}
	<div>
		<Button icon="plus" onclick={() => openDialog(null)}>Add field</Button>
	</div>
</SettingSection>

<FieldDialog bind:open={dialogOpen} field={editing} {takenKeys} onSave={save} />

<style>
	.typeIcon {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: var(--control-md);
		height: var(--control-md);
		border-radius: var(--radius-md);
		background: var(--surface-3);
		color: var(--text-2);
	}
	.rowContent {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-width: 0;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}
	.summary {
		display: flex;
		flex: 1 1 200px;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.label {
		font-size: var(--text-sm);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.description {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	code {
		padding: 1px var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		font-family: var(--font-mono);
	}
</style>
