<script lang="ts">
	import { Card, SuggestionMenu, Textarea, type Suggestion } from '$lib/components/ui';

	const snippets: Suggestion[] = [
		{ id: 'demo', label: '/demo', detail: 'The demo link does not load. Please fix it.' },
		{ id: 'readme', label: '/readme', detail: 'Add setup steps to the README.' },
		{ id: 'thanks', label: '/thanks', detail: 'Great work, thanks for shipping!' }
	];

	let note = $state('Type / to see the suggestions.\n/');
	let activeIndex = $state(0);
	const query = $derived(/(?:^|\s)\/([a-z]*)$/.exec(note)?.[1] ?? null);
	const matches = $derived(
		query === null ? [] : snippets.filter((snippet) => snippet.label.startsWith(`/${query}`))
	);

	function pick(suggestion: Suggestion) {
		note = note.replace(/\/[a-z]*$/, suggestion.detail ?? '');
	}
</script>

<h2>Suggestions</h2>
<Card>
	<div class="stack">
		<h3>SuggestionMenu</h3>
		<div class="anchor">
			{#if matches.length}
				<SuggestionMenu
					id="styleguideSuggestions"
					label="Snippets"
					suggestions={matches}
					hint="Floats above its positioned parent. Click an option to insert it."
					bind:activeIndex
					onPick={pick}
				/>
			{/if}
			<Textarea
				label="Note"
				name="styleguideSuggestionNote"
				rows={3}
				aria-controls="styleguideSuggestions"
				bind:value={note}
			/>
		</div>
	</div>
</Card>

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
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.anchor {
		position: relative;
		max-width: 420px;
		/* room for the menu, which opens upward */
		margin-top: calc(var(--space-7) * 3);
	}
</style>
