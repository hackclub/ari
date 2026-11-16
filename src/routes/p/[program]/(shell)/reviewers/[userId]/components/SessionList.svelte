<script lang="ts">
	import StatusBadge from '$lib/components/app/StatusBadge.svelte';
	import { Badge, EmptyState, List, ListRow } from '$lib/components/ui';
	import { reviewHref } from '$lib/shipList';
	import type { PageData } from '../$types';
	import Section from './Section.svelte';

	interface Props {
		sessions: PageData['sessions'];
		programId: string;
		rangeActive: boolean;
	}
	let { sessions, programId, rangeActive }: Props = $props();
</script>

<Section title="Review sessions" icon="chart" flush={sessions.length > 0}>
	{#if sessions.length}
		<ol class="sessions">
			{#each sessions as session, sessionIndex (sessionIndex)}
				<li class="session">
					<div class="sessionHead">
						<div class="sessionCopy">
							<span class="started" title={session.startedAgo}>{session.startedWhen}</span>
							<span class="summary">
								{session.reviewCount} review{session.reviewCount === 1 ? '' : 's'} · {session.total}
								total
							</span>
						</div>
						{#if session.live}
							<Badge tone="approved" dot>Active</Badge>
						{:else if session.reason === 'idle'}
							<Badge tone="pending">Timed out</Badge>
						{:else}
							<Badge>Finished</Badge>
						{/if}
					</div>
					<List flush>
						{#each session.reviews as review, reviewIndex (reviewIndex)}
							<ListRow title={review.title} href={reviewHref(programId, review.submissionId, null)}>
								{#snippet actions()}
									{#if review.decision}
										<StatusBadge status={review.decision} />
									{:else if review.live}
										<Badge tone="approved" dot>Reviewing…</Badge>
									{:else if review.reason === 'idle'}
										<Badge tone="pending">Timed out</Badge>
									{:else}
										<Badge>No decision</Badge>
									{/if}
									<span class="duration" title={review.ago}>{review.duration}</span>
								{/snippet}
							</ListRow>
						{/each}
					</List>
				</li>
			{/each}
		</ol>
	{:else}
		<EmptyState
			title={rangeActive ? 'No review sessions in this period' : 'No review sessions yet'}
			icon="chart"
		/>
	{/if}
</Section>

<style>
	.sessions {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.session + .session {
		border-top: 1px solid var(--border);
	}
	.sessionHead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-2);
	}
	.sessionCopy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.started {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.summary {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.duration {
		min-width: var(--space-7);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		text-align: right;
		color: var(--text-2);
	}
</style>
