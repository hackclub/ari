<script lang="ts">
	import { ConfirmDialog, KeyValue, Notice, type KeyValueItem } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import type { ConfirmAction } from '$lib/review/state/secondPass.svelte';
	import { formatDuration } from '$lib/time';
	import NoteQuote from './NoteQuote.svelte';

	interface Props {
		open: boolean;
		action: ConfirmAction;
	}
	let { open = $bindable(), action }: Props = $props();

	const { context, draft, secondPass, settlement, validation, keybinds } = useReview();

	const held = $derived(context.heldDecision ?? 'approved');
	const nouns = { approved: 'approval', changes: 'request for changes', rejected: 'rejection' };
	const labels = {
		approved: 'Confirm approval',
		changes: 'Confirm changes',
		rejected: 'Confirm rejection'
	};
	const tones = { approved: 'ok', changes: 'default', rejected: 'danger' } as const;
	const icons = { approved: 'check', changes: 'clock', rejected: 'x' } as const;

	const copy = $derived(
		action === 'confirm'
			? {
					title: `${labels[held]} of ${context.ship.title}?`,
					description:
						held === 'approved'
							? `The approval goes out to ${context.programName} and ${formatDuration(settlement.approvedSeconds)} is approved.`
							: `The ${nouns[held]} goes out to ${context.programName}.`,
					label: labels[held],
					tone: tones[held],
					icon: icons[held]
				}
			: action === 'confirmChanges'
				? {
						title: `Request changes on ${context.ship.title}?`,
						description: `The request for changes goes out to ${context.programName}. This replaces the held ${nouns[held]}; the ship is not approved.`,
						label: 'Request changes',
						tone: 'default' as const,
						icon: 'clock' as const
					}
				: {
						title: `Reject ${context.ship.title}?`,
						description: `The rejection goes out to ${context.programName}. This replaces the held ${nouns[held]}; the ship is not approved.`,
						label: 'Reject',
						tone: 'danger' as const,
						icon: 'x' as const
					}
	);

	const approving = $derived(action === 'confirm' && held === 'approved');
	const gaps = $derived(validation.confirmGaps(action));

	const items = $derived<KeyValueItem[]>([
		{
			key: 'Held decision',
			value: `${nouns[held]} by ${context.recorded?.reviewerName ?? 'a reviewer'}`
		},
		...(approving
			? [
					{
						key: 'Credited time',
						value: draft.timeEdited
							? `${formatDuration(settlement.approvedSeconds)} (re-settled from your edits)`
							: `${formatDuration(settlement.approvedSeconds)} (as held)`,
						mono: true
					},
					...(settlement.deflateSeconds > 0
						? [
								{
									key: 'Deflated',
									value: `−${formatDuration(settlement.deflateSeconds)}`,
									mono: true
								}
							]
						: [])
				]
			: []),
		{ key: 'Delivery', value: `Sent to ${context.programName} now.` }
	]);
</script>

<ConfirmDialog
	bind:open
	title={copy.title}
	description={copy.description}
	icon={copy.icon}
	tone={copy.tone}
	size="md"
	confirmLabel="{copy.label} ({keybinds.label(
		action === 'confirmChanges' ? 'decChanges' : 'decApprove'
	)})"
	confirmIcon={copy.icon}
	busy={secondPass.busy !== null}
	onConfirm={() => secondPass.confirm(action)}
>
	<div class="body" data-review-region="heldConfirm">
		<KeyValue {items} />
		<NoteQuote label="Note to maker · shared" text={draft.value.note} />
		{#if gaps.length}
			<Notice>
				<div class="gaps" data-review-region="confirmGaps">
					<p>
						A first-pass {nouns[
							action === 'confirm' ? held : action === 'confirmChanges' ? 'changes' : 'rejected'
						]}
						would also need the following. You can confirm without them.
					</p>
					<ul>
						{#each gaps as gap (gap.code)}
							<li data-gap={gap.code}>{gap.message}</li>
						{/each}
					</ul>
				</div>
			</Notice>
		{/if}
	</div>
</ConfirmDialog>

<style>
	.body,
	.gaps {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.gaps {
		gap: var(--space-1);
	}
	p {
		margin: 0;
		font-weight: 600;
	}
	ul {
		margin: 0;
		padding-left: var(--space-4);
	}
</style>
