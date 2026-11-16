<script lang="ts">
	import { copyText } from '$lib/actions';
	import {
		Button,
		Card,
		Dialog,
		ProgressBar,
		SaveBar,
		StatTile,
		TextField,
		ThemeToggle
	} from '$lib/components/ui';
	import { toast } from '$lib/toast.svelte';

	let savedName = $state('Program 1');
	let programName = $state('Program 1');
	let saving = $state(false);
	let dialogOpen = $state(false);
	const dirty = $derived(programName !== savedName);

	function save() {
		saving = true;
		// stands in for a form action round trip
		setTimeout(() => {
			savedName = programName;
			saving = false;
			toast.success('Program saved');
		}, 900);
	}
</script>

<h2>Feedback</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>Toasts</h3>
			<div class="row">
				<Button onclick={() => toast.success('Approved ship 4821')}>Success</Button>
				<Button onclick={() => toast.info('Sent back for changes', { icon: 'clock' })}>Info</Button>
				<Button onclick={() => toast.error('Could not save program')}>Error</Button>
				<Button onclick={() => toast.show('Held for second pass', 'info', { durationMs: 10000 })}>
					Generic form, 10 seconds
				</Button>
				<Button icon="clip" onclick={() => copyText('ari_mcp_example', 'Token copied')}>
					copyText
				</Button>
				<Button onclick={() => (dialogOpen = true)}>Toast from inside a dialog</Button>
			</div>
		</div>
	</Card>

	<Dialog bind:open={dialogOpen} title="Toasts over a dialog">
		Toasts fired while a dialog is open stay above it and can be dismissed.
		{#snippet footer()}
			<Button onclick={() => toast.success('Copied from the dialog')}>Fire success</Button>
			<Button variant="danger" onclick={() => toast.error('Could not save the decision')}>
				Fire error
			</Button>
		{/snippet}
	</Dialog>

	<Card>
		<div class="stack">
			<h3>SaveBar</h3>
			<TextField
				label="Program name"
				name="feedbackProgramName"
				bind:value={programName}
				hint="Edit this to make the form dirty; the bar slides in at the bottom of the window."
			/>
		</div>
	</Card>
	<SaveBar
		{dirty}
		{saving}
		reserveSpace={false}
		onSave={save}
		onDiscard={() => (programName = savedName)}
	/>

	<div>
		<h3 class="loose">StatTile</h3>
		<div class="tiles">
			<StatTile label="In queue" value={128} subLabel="12 older than a week" />
			<StatTile label="Approved" value="1,204" tone="ok" subLabel="Up 8%" />
			<StatTile label="Median wait" value={3} unit="d" tone="warn" subLabel="Slower" />
			<StatTile label="Rejected" value={17} tone="danger" subLabel="2 today" />
			<StatTile label="Reviewers" value={9} tone="info" />
			<StatTile label="This week" value={32} unit="/ 50">
				<ProgressBar label="Weekly goal" value={32} max={50} size="sm" />
			</StatTile>
		</div>
	</div>

	<Card>
		<div class="stack">
			<h3>ThemeToggle</h3>
			<div class="row">
				<ThemeToggle />
				<ThemeToggle size="sm" />
				<ThemeToggle showLabel />
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
	.loose {
		margin-bottom: var(--space-3);
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
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
	}
</style>
