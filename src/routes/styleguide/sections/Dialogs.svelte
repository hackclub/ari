<script lang="ts">
	import {
		Button,
		Card,
		ConfirmDialog,
		Dialog,
		Lightbox,
		ReasonDialog,
		type LightboxItem
	} from '$lib/components/ui';

	let flagOpen = $state(false);
	let shortcutsOpen = $state(false);
	let confirmOpen = $state(false);
	let deleteOpen = $state(false);
	let failingOpen = $state(false);
	let revertOpen = $state(false);
	let noteOpen = $state(false);
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);
	let lastResult = $state('Nothing confirmed yet.');

	const shortcuts = [
		{ keys: 'A', action: 'Approve' },
		{ keys: 'C', action: 'Request changes' },
		{ keys: 'R', action: 'Reject' },
		{ keys: 'J / K', action: 'Next / previous ship' },
		{ keys: '?', action: 'Show this list' }
	];

	function placeholder(fill: string, text: string) {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="48" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(svg)}`;
	}
	const pictures: LightboxItem[] = [
		{ src: placeholder('tomato', 'Screenshot 1'), alt: 'First screenshot', caption: 'Home screen' },
		{ src: placeholder('teal', 'Screenshot 2'), alt: 'Second screenshot', caption: 'Settings' },
		{ src: placeholder('slateblue', 'Screenshot 3'), alt: 'Third screenshot' }
	];

	function fakeAction(result: string) {
		// 1500ms: stands in for a form action round trip
		return new Promise<void>((resolve) =>
			setTimeout(() => {
				lastResult = result;
				resolve();
			}, 1500)
		);
	}

	function failingAction() {
		// 1500ms: stands in for a form action round trip
		return new Promise<void>((resolve, reject) =>
			setTimeout(() => reject(new Error('The ship was claimed by someone else.')), 1500)
		);
	}
</script>

<h2>Dialogs</h2>
<Card>
	<div class="stack">
		<h3>Dialog</h3>
		<div class="row">
			<Button onclick={() => (flagOpen = true)}>Detail with footer</Button>
			<Button onclick={() => (shortcutsOpen = true)}>Large</Button>
		</div>
		<h3>ConfirmDialog</h3>
		<div class="row">
			<Button onclick={() => (confirmOpen = true)}>Async confirm</Button>
			<Button variant="danger" onclick={() => (deleteOpen = true)}>Danger confirm</Button>
			<Button onclick={() => (failingOpen = true)}>Confirm that fails</Button>
		</div>
		<h3>ReasonDialog</h3>
		<div class="row">
			<Button onclick={() => (revertOpen = true)}>Required, 10 characters minimum</Button>
			<Button onclick={() => (noteOpen = true)}>Optional reason</Button>
		</div>
		<h3>Lightbox</h3>
		<div class="row">
			<Button icon="image" onclick={() => (lightboxOpen = true)}>Open gallery</Button>
		</div>
		<p>{lastResult}</p>
	</div>
</Card>

<Dialog
	bind:open={flagOpen}
	title="Repository created after the hours were logged"
	description="Raised automatically when the ship was ingested."
	icon="flag"
	tone="warn"
>
	<p>
		The first commit is newer than most of the tracked time. Check the history before approving.
	</p>
	{#snippet footer()}
		<Button variant="quiet" onclick={() => (flagOpen = false)}>Dismiss flag</Button>
		<Button data-autofocus onclick={() => (flagOpen = false)}>Close</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={shortcutsOpen} title="Keyboard shortcuts" size="lg">
	<dl class="shortcuts">
		{#each shortcuts as shortcut (shortcut.keys)}
			<div>
				<dt>{shortcut.action}</dt>
				<dd>{shortcut.keys}</dd>
			</div>
		{/each}
	</dl>
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Approve ship 4821?"
	icon="check"
	tone="ok"
	confirmLabel="Approve"
	confirmIcon="check"
	onConfirm={() => fakeAction('Approved ship 4821.')}
>
	<p>The approval goes out to the program and 12h 30m is approved.</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this track?"
	tone="danger"
	confirmLabel="Delete track"
	onConfirm={() => fakeAction('Deleted the track.')}
>
	<p>Ships already reviewed keep their decision. This cannot be undone.</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={failingOpen}
	title="Claim ship 4822?"
	confirmLabel="Claim"
	onConfirm={failingAction}
>
	<p>This action always fails, so the dialog stays open and shows why.</p>
</ConfirmDialog>

<ReasonDialog
	bind:open={revertOpen}
	title="Return ship 4821 to the queue"
	description="This rolls the decision back. The ship reopens on the queue."
	icon="inbox"
	reasonLabel="Audit reason"
	placeholder="Why the decision is being rolled back."
	hint="Shared with the program along with your name, never with the maker."
	minLength={10}
	confirmLabel="Return to queue"
	confirmIcon="inbox"
	onConfirm={(reason) => fakeAction(`Returned to queue: ${reason}`)}
/>

<ReasonDialog
	bind:open={noteOpen}
	title="Reject ship 4821?"
	tone="danger"
	required={false}
	reasonLabel="Note to maker"
	confirmLabel="Reject"
	onConfirm={(reason) => fakeAction(reason ? `Rejected: ${reason}` : 'Rejected without a note.')}
/>

<Lightbox bind:open={lightboxOpen} bind:index={lightboxIndex} items={pictures} />

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
	.shortcuts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-2) var(--space-5);
		margin: 0;
	}
	.shortcuts div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.shortcuts dd {
		margin: 0;
		font-family: var(--font-mono);
		color: var(--text-2);
	}
</style>
