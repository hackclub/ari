<script lang="ts">
	import { Button } from '$lib/components/ui';
	import ShortcutList from '$lib/components/review/shell/ShortcutList.svelte';
	import { ReviewKeybinds } from '$lib/review/state/reviewKeybinds.svelte';

	const keybinds = new ReviewKeybinds();
</script>

<!-- with nothing registered here, the listener exists only so a pressed key lands in the capture -->
<svelte:window onkeydown={keybinds.handleKey} />

<div class="row">
	<div>
		<h2>Keyboard shortcuts</h2>
		<p>The review workspace shortcuts, shared by every program. Stored in this browser.</p>
	</div>
</div>

<ShortcutList {keybinds} dimInactive={false} escLabel={keybinds.capturing ? 'Cancel' : undefined} />

<div class="actions">
	<Button variant="quiet" onclick={() => keybinds.resetAll()}>Reset all</Button>
</div>

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
	.actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
