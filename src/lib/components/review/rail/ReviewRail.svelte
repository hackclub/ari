<script lang="ts">
	import { privateProvider } from '$private';
	import type { Snippet } from 'svelte';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import ChecklistSection from './ChecklistSection.svelte';
	import CollaboratorPanel from './CollaboratorPanel.svelte';
	import CustomFieldsSection from './CustomFieldsSection.svelte';
	import HoursSummary from './HoursSummary.svelte';
	import NotesSection from './NotesSection.svelte';
	import ReviewerNoteField from './ReviewerNoteField.svelte';

	interface Props {
		footer: Snippet;
	}
	let { footer }: Props = $props();

	const review = useReview();
	const { context, wizard, keybinds } = review;
	const RailExtras = privateProvider.slots.reviewRailExtras;
	const shipRef = $derived({ submissionId: context.ship.id, programId: context.programId });

	const hasChecklist = $derived(context.data.checklist.length + context.data.fixes.length > 0);

	// a wizard step that leaves takes the focused control with it. a keyboard user lands on the
	// next step's first field instead of the page body; a pointer user keeps the plain shortcuts
	let sections = $state<HTMLElement>();
	let keyboardInside = false;
	$effect.pre(() => {
		void wizard.current;
		const focused = document.activeElement;
		keyboardInside = Boolean(
			focused && sections?.contains(focused) && focused.matches(':focus-visible')
		);
	});
	$effect(() => {
		void wizard.current;
		if (!keyboardInside || document.activeElement !== document.body) return;
		sections
			?.querySelector<HTMLElement>('[data-review-field] :is(input, textarea, select, button)')
			?.focus();
	});

	// registered here, not in the notes section: that section is unmounted on other wizard
	// steps, and the shortcut has to bring it back
	$effect(() =>
		keybinds.registerShortcuts('notes', [
			{
				id: 'note',
				label: 'Focus note',
				defaultBinding: 'n',
				when: () => !context.closed || context.secondPass,
				handler: () => void review.reveal('note')
			},
			{
				id: 'audit',
				label: 'Focus audit',
				defaultBinding: 'i',
				when: () => !context.closed || context.secondPass,
				handler: () => void review.reveal('audit')
			}
		])
	);
</script>

<div class="rail">
	<div
		class="sections"
		data-review-region="railSections"
		data-wizard-step={wizard.current}
		bind:this={sections}
	>
		<HoursSummary />
		<CollaboratorPanel />
		{#if RailExtras}<RailExtras ship={shipRef} />{/if}
		{#if wizard.shows('checklist') && hasChecklist}
			<ChecklistSection />
		{/if}
		{#if wizard.shows('notes')}
			<NotesSection />
		{/if}
		{#if wizard.shows('fields') && context.data.customFields.length}
			<CustomFieldsSection />
		{/if}
		<ReviewerNoteField />
	</div>
	<div class="footer" data-review-region="railFooter">
		{@render footer()}
	</div>
</div>

<style>
	.rail {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.sections {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-5);
		min-height: 0;
		padding: var(--space-4);
		overflow-y: auto;
	}
	.footer {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: var(--space-2);
		max-height: 60%;
		padding: var(--space-3) var(--space-4);
		overflow-y: auto;
		border-top: 1px solid var(--border-2);
		background: var(--surface);
	}
	@media (max-width: 700px) {
		.sections {
			overflow-y: visible;
		}
		.footer {
			max-height: none;
			overflow-y: visible;
		}
	}
</style>
