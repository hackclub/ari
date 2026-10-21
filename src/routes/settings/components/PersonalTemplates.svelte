<script lang="ts">
	import {
		Badge,
		Button,
		Dialog,
		List,
		ListRow,
		Notice,
		Textarea,
		TextField
	} from '$lib/components/ui';
	import { personalTemplates, type PersonalTemplate } from '$lib/personalTemplates.svelte';
	import { slugName } from '$lib/settingsRules';

	let dialogOpen = $state(false);
	let editId = $state<string | null>(null);
	let name = $state('');
	let body = $state('');
	let saveError = $state<string | null>(null);

	const resolvedName = $derived(slugName(name));
	const nameError = $derived(
		resolvedName &&
			personalTemplates.list.some(
				(template) => template.id !== editId && template.name === resolvedName
			)
			? `A template named /${resolvedName} already exists.`
			: null
	);
	// 5000 characters is the longest template the editor stores
	const canSave = $derived(
		Boolean(resolvedName) && Boolean(body.trim()) && body.trim().length <= 5000 && !nameError
	);

	function openCreate() {
		editId = null;
		name = '';
		body = '';
		saveError = null;
		dialogOpen = true;
	}

	function openEdit(template: PersonalTemplate) {
		if (template.builtIn) return;
		editId = template.id;
		name = template.name;
		body = template.body;
		saveError = null;
		dialogOpen = true;
	}

	function save() {
		if (!canSave) return;
		const failure = editId
			? personalTemplates.update(editId, name, body)
			: personalTemplates.add(name, body);
		if (failure) {
			saveError = failure;
			return;
		}
		dialogOpen = false;
	}

	function toggleEnabled(template: PersonalTemplate) {
		personalTemplates.setEnabled(template.id, !template.enabled);
	}

	function removeTemplate(templateId: string) {
		personalTemplates.remove(templateId);
	}
</script>

<div class="row">
	<div>
		<h2>Response templates</h2>
		<p>
			Personal slash-command templates for the note to the maker. Type <code>/name</code> in any review
			note box to insert one.
		</p>
	</div>
</div>

<List aria-label="Personal templates">
	{#each personalTemplates.list as template (template.id)}
		<ListRow title={`/${template.name}`}>
			<span class="metaRow">
				{#if template.builtIn}<Badge>Default</Badge>{/if}
				{#if !template.enabled}<Badge>Off</Badge>{/if}
				<span class="body">{template.body}</span>
			</span>
			{#snippet actions()}
				<Button size="sm" variant="quiet" onclick={() => toggleEnabled(template)}>
					{template.enabled ? 'Disable' : 'Enable'}
				</Button>
				{#if !template.builtIn}
					<Button size="sm" variant="quiet" onclick={() => openEdit(template)}>Edit</Button>
					<Button
						size="sm"
						variant="quiet"
						icon="x"
						aria-label={`Delete /${template.name}`}
						onclick={() => removeTemplate(template.id)}
					/>
				{/if}
			{/snippet}
		</ListRow>
	{/each}
</List>

<div>
	<Button icon="plus" onclick={openCreate}>Add template</Button>
</div>

<Dialog bind:open={dialogOpen} title={editId ? 'Edit template' : 'Add template'} icon="msg">
	<div class="editor">
		<TextField
			label="Name"
			name="templateName"
			mono
			placeholder="reviewers type /this-name"
			hint={resolvedName && resolvedName !== name ? `Saved as /${resolvedName}` : undefined}
			error={nameError}
			data-autofocus
			bind:value={name}
		/>
		<Textarea
			label="Text"
			name="templateBody"
			rows={5}
			maxlength={5000}
			placeholder="Template text inserted into the note to the maker…"
			bind:value={body}
		/>
		{#if saveError}<Notice tone="danger">{saveError}</Notice>{/if}
	</div>
	{#snippet footer()}
		<Button variant="quiet" onclick={() => (dialogOpen = false)}>Cancel</Button>
		<Button variant="primary" disabled={!canSave} onclick={save}>
			{editId ? 'Done' : 'Add template'}
		</Button>
	{/snippet}
</Dialog>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 700;
	}
	p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	code {
		font-family: var(--font-mono);
	}
	.metaRow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.body {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
