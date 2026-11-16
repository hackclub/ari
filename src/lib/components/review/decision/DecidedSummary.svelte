<script lang="ts">
	import StatusBadge from '$lib/components/app/StatusBadge.svelte';
	import { Button, Icon, ReasonDialog, Textarea } from '$lib/components/ui';
	import type { Status } from '$lib/data';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import NoteQuote from './NoteQuote.svelte';

	const { context, secondPass, settlement } = useReview();
	const recorded = $derived(context.recorded);
	const status = $derived(context.ship.status);

	const verbs = { approved: 'Approved', changes: 'Sent back for changes', rejected: 'Rejected' };

	let revertOpen = $state(false);
	let requeueOpen = $state(false);
	let publicNote = $state('');
</script>

<section class="decided" data-review-region="decidedSummary">
	<p class="head">
		<Icon name="checkCircle" size={16} />
		<strong>Review complete</strong>
		<StatusBadge status={status as Status} />
	</p>
	{#if recorded}
		<p class="who" data-decided-by={recorded.reviewerName}>
			{verbs[recorded.decision]} by {recorded.reviewerName} · {recorded.when}
		</p>
		{#if recorded.decision === 'approved'}
			<p class="time">
				<span data-recorded-seconds={settlement.approvedSeconds}>
					{formatDuration(settlement.approvedSeconds)}
				</span>
				approved
			</p>
		{/if}
		{#if recorded.note.trim()}
			<NoteQuote label="Note to maker · shared" text={recorded.note} />
		{/if}
		{#if recorded.audit.trim()}
			<NoteQuote label="Audit · internal" text={recorded.audit} internal />
		{/if}
	{/if}
	{#if status === 'reverted'}
		<p class="state"><Icon name="arrowL" size={13} /> Unshipped. The project can ship again.</p>
	{:else if status === 'withdrawn'}
		<p class="state">
			<Icon name="arrowL" size={13} /> Withdrawn by {context.programName}. The project can ship
			again.
		</p>
	{:else if status === 'fraudreview'}
		<p class="state">
			<Icon name="shield" size={13} /> Under review. No one can act on it until the verdict lands.
		</p>
	{:else if context.shipState.decided && !context.shipState.canRevert}
		<p class="state">
			<Icon name="shield" size={13} /> Decided. Only organizers can requeue or unship it.
		</p>
	{/if}
</section>

{#if context.shipState.canRevert}
	<Button
		block
		icon="inbox"
		disabled={secondPass.busy !== null}
		data-override="requeue"
		onclick={() => (requeueOpen = true)}
	>
		Return to queue
	</Button>
	<Button
		block
		icon="arrowL"
		disabled={secondPass.busy !== null}
		data-override="revert"
		onclick={() => {
			publicNote = '';
			revertOpen = true;
		}}
	>
		Unship
	</Button>

	<ReasonDialog
		bind:open={requeueOpen}
		title="Return {context.ship.title} to the queue"
		description="This rolls the decision back. The ship reopens on the queue and can be approved, sent back for changes, or rejected again. The withdrawn decision stays in the project history, and {context.programName} gets a heads-up so it can undo anything it did on it."
		icon="inbox"
		confirmLabel="Return to queue"
		confirmIcon="inbox"
		reasonLabel="Audit reason · internal"
		placeholder="Why the decision is being rolled back. Shared with {context.programName} along with your name, never with the maker."
		busy={secondPass.busy === 'requeue'}
		onConfirm={(reason) => secondPass.requeue(reason)}
	/>

	<ReasonDialog
		bind:open={revertOpen}
		title="Unship {context.ship.title}"
		description="This unships the project for good. It won't return to the queue. {context.programName} gets your audit reason and can re-ship it as a new version."
		icon="arrowL"
		tone="danger"
		confirmLabel="Unship"
		confirmIcon="arrowL"
		reasonLabel="Audit reason · internal"
		placeholder="Why it was unshipped. Shared with {context.programName} along with your name, never with the maker."
		busy={secondPass.busy === 'revert'}
		onConfirm={(reason) => secondPass.revert({ publicNote, auditReason: reason })}
	>
		<Textarea
			label="Message to maker · shared"
			name="revertPublicNote"
			rows={3}
			required
			placeholder="e.g. We had to unship this because the demo video is missing. Resubmit once it's added."
			bind:value={publicNote}
		/>
	</ReasonDialog>
{/if}

<style>
	.decided {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	p {
		margin: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-3);
		font-size: var(--text-sm);
	}
	.head strong {
		flex: 1;
		color: var(--text);
		font-weight: 600;
	}
	.who,
	.state {
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	.state {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.time {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	.time span {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-weight: 600;
	}
</style>
