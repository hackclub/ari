<script lang="ts">
	import { privateProvider } from '$private';
	import { invalidateAll } from '$app/navigation';
	import { submitAction } from '$lib/actions';
	import { Button, Icon } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { toast } from '$lib/toast.svelte';

	const { context, claim } = useReview();

	const snapshot = $derived(context.data.snapshot);
	const issue = $derived(snapshot.issue);
	// the server recaptures a pending ship, and a held one for whoever may confirm it
	const canRecapture = $derived(context.ship.status === 'pending' || context.canEditHeld);

	let recapturing = $state(false);
	let run = 0;

	// leaving the ship abandons the poll
	$effect(() => {
		void context.ship.id;
		return () => {
			run += 1;
			recapturing = false;
		};
	});

	const pause = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

	// queues a fresh capture, then waits for the snapshot version to move past the one it replaced
	async function recapture() {
		if (recapturing || !claim.guardLock()) return;
		const current = ++run;
		const actionUrl = `/p/${context.programId}/review/${context.ship.id}`;
		recapturing = true;
		try {
			const started = await submitAction<{ version: number }>(
				'resync',
				{},
				{ actionUrl, invalidate: false, fallbackMessage: 'Could not start the recapture.' }
			);
			if (current !== run) return;
			if (!started.ok) {
				toast.error(started.message, { icon: 'flag' });
				return;
			}
			const baseline = Number(started.data?.version ?? NaN);
			// 40 polls 3 s apart: two minutes, longer than a capture normally takes
			for (let attempt = 0; attempt < 40; attempt++) {
				await pause(3000);
				if (current !== run) return;
				const poll = await submitAction<{ version: number }>(
					'resyncStatus',
					{},
					{ actionUrl, invalidate: false }
				);
				if (current !== run) return;
				if (poll.ok && Number(poll.data?.version ?? NaN) > baseline) {
					await invalidateAll();
					toast.success('Evidence recaptured');
					return;
				}
			}
			toast.info('The recapture is still running. Reload in a bit to see it.');
		} finally {
			if (current === run) recapturing = false;
		}
	}
</script>

{#if !snapshot.synced}
	<section class="syncNotice" role="status" data-review-region="syncNotice">
		<h2><Icon name="flag" size={13} /> Evidence capture incomplete</h2>
		<p>
			The last capture could not fully read the time evidence, so these numbers may be missing time.
			{#if issue}Last attempt {issue.when === 'now' ? 'just now' : `${issue.when} ago`}.{/if}
			{#if issue?.exhausted}No further automatic attempts are scheduled.{/if}
		</p>
		{#if issue && (issue.notes.length > 0 || issue.error)}
			<ul>
				{#each issue.notes as note, index (index)}
					<li>{privateProvider.describeCaptureNote(note) ?? note}</li>
				{/each}
				{#if issue.notes.length === 0 && issue.error}
					<li>{issue.error}</li>
				{/if}
			</ul>
		{/if}
		{#if canRecapture}
			<div>
				<Button
					size="sm"
					icon="refresh"
					loading={recapturing}
					disabled={context.readOnly}
					data-review-recapture
					onclick={recapture}
				>
					{recapturing ? 'Recapturing…' : 'Recapture evidence'}
				</Button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.syncNotice {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--color-orange) 30%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-orange) 8%, var(--surface));
		color: var(--text-2);
		font-size: var(--text-sm);
		line-height: 1.45;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--color-orange);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	p {
		margin: 0;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding-left: var(--space-4);
		overflow-wrap: anywhere;
	}
</style>
