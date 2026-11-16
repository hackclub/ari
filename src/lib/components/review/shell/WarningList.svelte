<script lang="ts">
	import { submitAction } from '$lib/actions';
	import { Button, Dialog, Icon, KeyValue, List, ListRow } from '$lib/components/ui';
	import type { ReviewWarning } from '$lib/review/reviewTypes';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { toast } from '$lib/toast.svelte';
	import SyncNotice from './SyncNotice.svelte';

	// warnings come from the private module: without it the list is empty and nothing renders

	const { context, claim } = useReview();

	const warnings = $derived(context.warnings);

	let open = $state(false);
	let shownId = $state<string | null>(null);
	let dismissing = $state(false);
	// kept while the dialog animates shut, so its text does not blank out
	let lastShown = $state.raw<ReviewWarning | null>(null);
	const shown = $derived(warnings.find((warning) => warning.id === shownId) ?? lastShown);

	function show(warning: ReviewWarning) {
		shownId = warning.id;
		lastShown = warning;
		open = true;
	}

	$effect(() => {
		void context.ship.id;
		open = false;
		shownId = null;
	});

	// a dismissal is stored, so the live checks do not raise the same warning on the next open
	async function dismiss() {
		if (!shown || dismissing || !claim.guardLock()) return;
		dismissing = true;
		const result = await submitAction(
			'dismiss',
			{ warningId: shown.id },
			{ actionUrl: `/p/${context.programId}/review/${context.ship.id}` }
		);
		dismissing = false;
		open = false;
		if (result.ok) toast.info('Flag dismissed', { icon: 'check' });
		else toast.error('Could not dismiss flag');
	}
</script>

<SyncNotice />

{#if warnings.length}
	<section class="warnings" data-review-region="warnings" aria-label="Automated flags">
		<h2>Automated flags</h2>
		<List>
			{#each warnings as warning (warning.id)}
				<ListRow title={warning.title} data-warning={warning.severity}>
					{#snippet leading()}
						<span class={['mark', warning.severity]}>
							<Icon name={warning.severity === 'danger' ? 'x' : 'flag'} size={15} />
						</span>
					{/snippet}
					{#snippet actions()}
						<Button size="sm" iconAfter="arrowR" onclick={() => show(warning)}>Details</Button>
					{/snippet}
				</ListRow>
			{/each}
		</List>
	</section>
{/if}

<Dialog
	bind:open
	title={shown?.title ?? 'Flag'}
	icon={shown?.severity === 'danger' ? 'x' : 'flag'}
	tone={shown?.severity === 'danger' ? 'danger' : 'warn'}
	size="md"
>
	{#if shown}
		<div class="detail" data-review-region="warningDetail">
			<section>
				<h3><Icon name="info" size={13} /> What this means</h3>
				<p>{shown.what}</p>
			</section>
			{#if shown.action}
				<section>
					<h3>What to do</h3>
					<p>{shown.action}</p>
				</section>
			{/if}
			{#if shown.matched.length}
				<section>
					<h3>What the check matched</h3>
					<KeyValue items={shown.matched.map((row) => ({ ...row, mono: true }))} />
				</section>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="quiet" loading={dismissing} onclick={dismiss}>Dismiss flag</Button>
		<Button data-autofocus onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.warnings {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	h2,
	h3 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.mark {
		display: inline-flex;
		color: var(--color-orange);
	}
	.mark.danger {
		color: var(--color-red);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.detail section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.detail p {
		margin: 0;
		color: var(--text);
		font-size: var(--text-md);
		line-height: 1.5;
		overflow-wrap: anywhere;
		/* a flag can say one thing per person, each on its own lines */
		white-space: pre-line;
	}
</style>
