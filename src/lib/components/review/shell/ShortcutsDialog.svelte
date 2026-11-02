<script lang="ts">
	import { Button, Dialog } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import ShortcutList from './ShortcutList.svelte';

	const { keybinds } = useReview();
</script>

<Dialog
	bind:open={keybinds.helpOpen}
	title="Keyboard shortcuts"
	description="Click a key, then press the one you want. Decision combos work even while typing in the notes."
	size="lg"
	dismissible={!keybinds.capturing}
	onClose={() => keybinds.closeHelp()}
>
	<ShortcutList {keybinds} escLabel="Cancel / close dialog" />
	{#snippet footer()}
		<Button variant="quiet" onclick={() => keybinds.resetAll()}>Reset all</Button>
		<Button variant="primary" onclick={() => keybinds.closeHelp()}>Done</Button>
	{/snippet}
</Dialog>
