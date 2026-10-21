<script lang="ts">
	import { tick } from 'svelte';
	import { SuggestionMenu, Textarea, type Suggestion } from '$lib/components/ui';
	import { personalTemplates } from '$lib/personalTemplates.svelte';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context, draft, validation } = useReview();

	const programSnippets = $derived(context.data.snippets);
	// personal templates win on a name clash so a reviewer's own wording sticks
	const snippets = $derived.by(() => {
		const personal = personalTemplates.enabled.map((template) => ({
			id: template.id,
			name: template.name,
			body: template.body
		}));
		const taken = new Set(personal.map((template) => template.name));
		return [...personal, ...programSnippets.filter((snippet) => !taken.has(snippet.name))];
	});

	let textarea: HTMLTextAreaElement | null = null;
	// the text after the slash being typed. null while the menu is closed
	let query = $state<string | null>(null);
	let slashIndex = 0;
	let activeIndex = $state(0);

	const matches = $derived.by(() => {
		if (query === null) return [];
		const wanted = query.toLowerCase();
		return snippets.filter((snippet) => snippet.name.startsWith(wanted));
	});
	const suggestions = $derived<Suggestion[]>(
		matches.map((snippet) => ({
			id: snippet.id,
			label: `/${snippet.name}`,
			detail: snippet.body
		}))
	);
	const open = $derived(suggestions.length > 0);

	function track(event: Event & { currentTarget: HTMLTextAreaElement }) {
		textarea = event.currentTarget;
		if (!draft.editable || !snippets.length) return;
		const caret = textarea.selectionStart ?? 0;
		// a slash at the start of the text or after whitespace, then the name so far
		const token = /(?:^|\s)\/([a-z0-9-]*)$/i.exec(textarea.value.slice(0, caret));
		if (!token) {
			query = null;
			return;
		}
		slashIndex = caret - token[1].length - 1;
		query = token[1];
		activeIndex = 0;
	}

	async function insert(index: number) {
		const snippet = matches[index];
		if (!snippet || !textarea) return;
		const text = draft.value.note;
		const caret = textarea.selectionStart ?? text.length;
		draft.value.note = text.slice(0, slashIndex) + snippet.body + text.slice(caret);
		const after = slashIndex + snippet.body.length;
		query = null;
		await tick();
		textarea.focus();
		textarea.setSelectionRange(after, after);
	}

	function onKeydown(event: KeyboardEvent) {
		// the decision combos always win
		if (!open || event.metaKey || event.ctrlKey) return;
		if (event.key === 'ArrowDown') activeIndex = (activeIndex + 1) % suggestions.length;
		else if (event.key === 'ArrowUp')
			activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
		else if (event.key === 'Enter' || event.key === 'Tab') void insert(activeIndex);
		else if (event.key === 'Escape') query = null;
		else return;
		// the page's key handler skips a prevented event, so escape closes the menu without
		// leaving the field
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<div class="noteField" data-review-field="note">
	{#if open}
		<SuggestionMenu
			id="noteSnippets"
			label="Snippets"
			{suggestions}
			hint="↑↓ choose · ↵ insert · esc dismiss"
			bind:activeIndex
			onPick={(suggestion, index) => void insert(index)}
		/>
	{/if}
	<Textarea
		label="Note to maker"
		name="note"
		autoGrow
		rows={3}
		hint={draft.editable && snippets.length
			? 'Shared with the maker. Type / for snippets.'
			: undefined}
		readonly={!draft.editable}
		error={validation.errorFor('note')}
		aria-controls={open ? 'noteSnippets' : undefined}
		aria-activedescendant={open ? `noteSnippets-${activeIndex}` : undefined}
		bind:value={draft.value.note}
		oninput={track}
		onclick={track}
		onkeydown={onKeydown}
		onblur={() => (query = null)}
	/>
</div>

<style>
	.noteField {
		position: relative;
	}
</style>
