<script lang="ts">
	import { Button, Checkbox, Icon, Kbd, ReasonDialog, Tooltip } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import type { ConfirmAction } from '$lib/review/state/secondPass.svelte';
	import { formatDuration } from '$lib/time';
	import BlockedList from './BlockedList.svelte';
	import HeldConfirmDialog from './HeldConfirmDialog.svelte';

	const { context, refusal, secondPass, settlement, validation, keybinds } = useReview();

	const held = $derived(context.heldDecision ?? 'approved');
	const nouns = { approved: 'approval', changes: 'request for changes', rejected: 'rejection' };
	const confirmCopy = {
		approved: { label: 'Confirm approval', variant: 'ok', icon: 'check' },
		changes: { label: 'Confirm changes', variant: 'ghost', icon: 'clock' },
		rejected: { label: 'Confirm rejection', variant: 'danger', icon: 'x' }
	} as const;

	let confirming = $state<ConfirmAction>('confirm');
	let confirmOpen = $state(false);
	let returnOpen = $state(false);
	let returnReason = $state('');
	let takeover = $state(false);

	function ask(action: ConfirmAction): void | false {
		if (document.querySelector('dialog[open]')) return false;
		if (!secondPass.request(action)) return;
		confirming = action;
		confirmOpen = true;
	}

	// the banner offering the reload must not sit behind a dialog
	$effect(() => {
		if (!refusal.staleIngest) return;
		confirmOpen = false;
		returnOpen = false;
	});

	async function sendBack() {
		if (await secondPass.returnToQueue(returnReason, { takeover })) {
			returnOpen = false;
			returnReason = '';
		}
	}

	// the affirmative keys confirm whichever dialog is open, as the key that opened it would
	async function affirm(action: ConfirmAction): Promise<void> {
		if (returnOpen) return sendBack();
		if (confirmOpen) {
			if (await secondPass.confirm(confirming)) confirmOpen = false;
			return;
		}
		ask(action);
	}

	$effect(() =>
		keybinds.registerShortcuts('secondPass', [
			{
				id: 'decApprove',
				label: 'Confirm held decision',
				defaultBinding: 'mod+Enter',
				allowInDialog: true,
				when: () => context.canEditHeld || returnOpen,
				handler: () => void affirm('confirm')
			},
			{
				id: 'decChanges',
				label: 'Request changes',
				defaultBinding: 'mod+shift+Enter',
				allowInDialog: true,
				when: () => (context.canEditHeld && (held !== 'changes' || confirmOpen)) || returnOpen,
				handler: () => void affirm('confirmChanges')
			},
			{
				id: 'decReject',
				label: 'Reject',
				defaultBinding: 'mod+Backspace',
				when: () => context.canEditHeld && held !== 'rejected',
				handler: () => ask('confirmReject')
			}
		])
	);
</script>

{#snippet act(
	action: ConfirmAction,
	label: string,
	variant: 'ok' | 'ghost' | 'danger',
	icon: 'check' | 'clock' | 'x',
	bind: 'decApprove' | 'decChanges' | 'decReject'
)}
	{@const why = validation.whyNot(action)}
	{#snippet button()}
		<Button
			{variant}
			block
			{icon}
			disabled={secondPass.busy !== null || why !== null}
			title={why ? undefined : keybinds.title(bind, label)}
			data-second-pass={action}
			onclick={() => ask(action)}
		>
			{label}
			<Kbd keys={keybinds.label(bind)} />
		</Button>
	{/snippet}
	<div class="act">
		{#if why}
			<Tooltip text={why}>{@render button()}</Tooltip>
		{:else}
			{@render button()}
		{/if}
	</div>
{/snippet}

<section class="held" data-review-region="heldSummary">
	<p class="head">
		<Icon name="shield" size={15} />
		<strong>Held {nouns[held]}</strong>
		{#if held === 'approved'}
			<span class="time" data-held-seconds={settlement.approvedSeconds}>
				{formatDuration(settlement.approvedSeconds)}
			</span>
		{/if}
	</p>
	<p class="who">
		{context.recorded
			? `By ${context.recorded.reviewerName} · ${context.recorded.when}.`
			: 'By a reviewer.'}
		Nothing was sent to {context.programName} yet.
	</p>
	{#if !context.viewer.canSecondPass}
		<p class="who">Waiting for an organizer to confirm it.</p>
	{:else if context.heldByViewer}
		<p class="who">Your decision needs another organizer to confirm it.</p>
	{:else}
		<p class="who">Notes, fields and time can be edited above. The checklist cannot.</p>
	{/if}
</section>

{#if context.viewer.canSecondPass}
	{#if !context.heldByViewer}
		<BlockedList action="confirm" heading="Before you can confirm" />
		{@render act(
			'confirm',
			confirmCopy[held].label,
			confirmCopy[held].variant,
			confirmCopy[held].icon,
			'decApprove'
		)}
		{#if held !== 'changes'}
			{@render act('confirmChanges', 'Request changes', 'ghost', 'clock', 'decChanges')}
		{/if}
		{#if held !== 'rejected'}
			{@render act('confirmReject', 'Reject', 'danger', 'x', 'decReject')}
		{/if}
	{/if}
	<Button
		block
		icon="inbox"
		disabled={secondPass.busy !== null}
		data-second-pass="return"
		onclick={() => {
			takeover = false;
			returnReason = '';
			returnOpen = true;
		}}
	>
		Return to queue
	</Button>

	<HeldConfirmDialog bind:open={confirmOpen} action={confirming} />

	<ReasonDialog
		bind:open={returnOpen}
		bind:reason={returnReason}
		title="Return {context.ship.title} to the queue"
		description="Withdraws the held decision and reopens this ship for a fresh review. The reviewer keeps their notes as a draft. {context.programName} is not notified: the decision never went through."
		icon="inbox"
		confirmLabel="Return to queue"
		confirmIcon="inbox"
		reasonLabel="Reason · internal"
		placeholder="Why is this decision being sent back? Recorded in the audit log."
		busy={secondPass.busy === 'return'}
		onConfirm={(reason) => secondPass.returnToQueue(reason, { takeover })}
	>
		<div class="takeover">
			<Checkbox bind:checked={takeover}>
				<strong>Re-review it myself</strong>
				<span>Stay on this ship and start from the reviewer's notes as your draft.</span>
			</Checkbox>
		</div>
	</ReasonDialog>
{/if}

<style>
	.held {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	p {
		margin: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--status-secondpass);
		font-size: var(--text-sm);
	}
	.head strong {
		flex: 1;
		color: var(--text);
		font-weight: 600;
	}
	.time {
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.who {
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	.act :global(.tooltip) {
		display: flex;
	}
	.act :global(.tooltip > .button) {
		flex: 1;
	}
	.takeover strong,
	.takeover span {
		display: block;
	}
	.takeover span {
		color: var(--text-2);
		font-size: var(--text-xs);
	}
</style>
