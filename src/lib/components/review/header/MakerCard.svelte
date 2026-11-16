<script lang="ts">
	import {
		Avatar,
		AvatarStack,
		Button,
		Dropdown,
		KeyValue,
		Notice,
		Skeleton,
		type KeyValueItem
	} from '$lib/components/ui';
	import type { MakerInfo } from '$lib/review/reviewTypes';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context } = useReview();
	const ship = $derived(context.ship);
	const collaborators = $derived(context.data.collaborators);

	let makers = $state.raw<MakerInfo[] | null>(null);
	let loading = $state(false);
	let failed = $state(false);

	// the live slack lookup runs when the card opens, so opening a ship never waits on it
	async function load() {
		if (loading || makers) return;
		loading = true;
		failed = false;
		try {
			const response = await fetch(`/p/${context.programId}/review/${ship.id}/maker`);
			if (!response.ok) throw new Error(`http ${response.status}`);
			makers = ((await response.json()) as { makers: MakerInfo[] }).makers;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	const row = (key: string, value: string | null): KeyValueItem => ({
		key,
		value: value || '-',
		copy: Boolean(value)
	});
	const rows = (maker: MakerInfo): KeyValueItem[] => [
		row('Name', maker.name),
		row('Email', maker.email),
		row('Slack ID', maker.slackId),
		row('Slack username', maker.slackUsername),
		row('Slack display name', maker.slackDisplayName),
		row('Hackatime ID', maker.hackatimeUserId)
	];
</script>

<Dropdown onOpen={load}>
	{#snippet trigger(triggerProps)}
		<Button
			variant="quiet"
			iconAfter="chevD"
			title="Submitter info"
			data-review-maker
			{...triggerProps}
		>
			{#if collaborators}
				<AvatarStack people={collaborators} size="sm" />
				<span class="who">
					<span class="name">{ship.author}</span>
					<span class="count">
						{collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'}
					</span>
				</span>
			{:else}
				<Avatar
					name={ship.author}
					color={ship.color}
					slackId={ship.authorSlackId}
					size="sm"
					decorative
				/>
				<span class="name">{ship.author}</span>
			{/if}
		</Button>
	{/snippet}
	<div class="card" data-review-region="makerCard">
		{#if failed}
			<Notice tone="danger">
				<span class="failure">
					Could not load maker info. Try again.
					<Button size="sm" icon="refresh" onclick={load}>Retry</Button>
				</span>
			</Notice>
		{:else if !makers}
			<div class="loading" aria-busy="true" aria-label="Loading maker info">
				<Skeleton width="60%" />
				<Skeleton width="80%" />
				<Skeleton width="50%" />
			</div>
		{:else}
			{#each makers as maker (maker.email)}
				<KeyValue items={rows(maker)} />
			{/each}
		{/if}
	</div>
</Dropdown>

<style>
	.who {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		line-height: 1.2;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		color: var(--text);
		font-weight: 600;
		text-overflow: ellipsis;
	}
	.count {
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(340px, 84vw);
		max-height: min(70vh, 520px);
		padding: var(--space-3) var(--space-4);
		overflow-y: auto;
	}
	.card :global(.keyValue + .keyValue) {
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.loading {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.failure {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
</style>
