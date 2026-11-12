<script lang="ts">
	import { submitAction } from '$lib/actions';
	import { Avatar, Button, ConfirmDialog, EmptyState, Textarea } from '$lib/components/ui';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from '../$types';
	import Section from './Section.svelte';

	interface Props {
		notes: PageData['notes'];
		subjectName: string;
		orgOperator: boolean;
	}
	let { notes, subjectName, orgOperator }: Props = $props();

	let draft = $state('');
	let adding = $state(false);
	let deleteOpen = $state(false);
	let deletingId = $state('');

	async function addNote() {
		const body = draft.trim();
		if (!body || adding) return;
		adding = true;
		const result = await submitAction(
			'addNote',
			{ body },
			{ errorToast: true, fallbackMessage: 'Could not add the note' }
		);
		adding = false;
		if (!result.ok) return;
		draft = '';
		toast.success('Note added');
	}

	async function deleteNote() {
		const result = await submitAction(
			'deleteNote',
			{ id: deletingId },
			{ errorToast: true, fallbackMessage: 'Could not delete the note' }
		);
		if (!result.ok) return false;
		toast.success('Note deleted');
	}
</script>

<Section title="Internal notes" icon="book" detail="Visible to POCs and org operators only">
	<div class="stack">
		<div class="compose">
			<Textarea
				label="New note"
				name="body"
				placeholder="Add an internal note about {subjectName}…"
				rows={3}
				maxlength={4000}
				bind:value={draft}
			/>
			<div class="composeActions">
				<Button
					variant="primary"
					size="sm"
					icon="plus"
					loading={adding}
					disabled={!draft.trim() || adding}
					onclick={addNote}
				>
					Add note
				</Button>
			</div>
		</div>

		{#if notes.length}
			<ul class="notes">
				{#each notes as note (note.id)}
					<li class="note">
						<Avatar
							name={note.authorName}
							color={note.authorColor}
							slackId={note.authorSlackId}
							size="sm"
							decorative
						/>
						<div class="noteCopy">
							<div class="noteMeta">
								<span class="author">{note.authorName}</span>
								<span title={note.ago}>{note.when}</span>
							</div>
							<p class="body">{note.body}</p>
						</div>
						{#if note.mine || orgOperator}
							<Button
								variant="quiet"
								size="sm"
								icon="x"
								aria-label="Delete note by {note.authorName} from {note.when}"
								onclick={() => {
									deletingId = note.id;
									deleteOpen = true;
								}}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState title="No notes yet" icon="book" />
		{/if}
	</div>
</Section>

<ConfirmDialog
	bind:open={deleteOpen}
	tone="danger"
	icon="x"
	title="Delete this note?"
	description="The note is removed for every POC and org operator."
	confirmLabel="Delete note"
	onConfirm={deleteNote}
/>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.compose {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.composeActions {
		display: flex;
		justify-content: flex-end;
	}
	.notes {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.note {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--border);
	}
	.noteCopy {
		flex: 1;
		min-width: 0;
	}
	.noteMeta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.author {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);
	}
	.body {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
