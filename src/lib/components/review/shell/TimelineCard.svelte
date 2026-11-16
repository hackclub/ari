<script lang="ts">
	import { Avatar, Button, Dialog, Icon, Notice, Skeleton } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { kindIcons, ShipTimeline } from './shipTimeline.svelte';
	import TimelineFilters from './TimelineFilters.svelte';

	const { context } = useReview();

	const timeline = new ShipTimeline();
	let open = $state(false);

	const load = () =>
		timeline.load(`/p/${context.programId}/review/${context.ship.id}/timeline`, context.ship.id);

	function show() {
		open = true;
		void load();
	}

	// the bar outlives the ship: another ship starts with no feed and no filters
	$effect(() => {
		void context.ship.id;
		open = false;
		timeline.reset();
	});
</script>

<Button size="sm" icon="clock" title="Ship timeline" data-review-timeline onclick={show}>
	<span class="wide">Timeline</span>
</Button>

<Dialog
	bind:open
	title="Timeline"
	description="Everything that happened to {context.ship.title}, oldest first."
	icon="clock"
	size="md"
>
	<div class="timeline" data-review-region="timeline">
		{#if timeline.error}
			<Notice tone="danger">
				<span class="failure">
					{timeline.error}
					<Button size="sm" icon="refresh" onclick={load}>Retry</Button>
				</span>
			</Notice>
		{:else if !timeline.items}
			<div class="loading" aria-busy="true" aria-label="Loading the timeline">
				<Skeleton width="70%" />
				<Skeleton width="45%" />
				<Skeleton width="60%" />
			</div>
		{:else if timeline.items.length === 0}
			<p class="empty">No activity yet.</p>
		{:else}
			<div class="filterBar">
				<Button
					size="sm"
					variant="quiet"
					icon="filter"
					iconAfter="chevD"
					aria-expanded={timeline.filtersOpen}
					onclick={() => (timeline.filtersOpen = !timeline.filtersOpen)}
				>
					Filter{timeline.activeFilterCount ? ` · ${timeline.activeFilterCount}` : ''}
				</Button>
				<span class="shown">{timeline.shown.length} of {timeline.items.length}</span>
			</div>
			{#if timeline.filtersOpen}
				<TimelineFilters {timeline} />
			{/if}
			{#if timeline.shown.length === 0}
				<p class="empty">Nothing matches these filters.</p>
			{:else}
				<ol class="rows">
					{#each timeline.shown as item (item.id)}
						<li class="row" data-kind={item.kind}>
							<span class="dot"><Icon name={kindIcons[item.kind]} size={13} /></span>
							<div class="body">
								{#if item.changes?.length}
									<Button
										size="sm"
										variant="quiet"
										iconAfter="chevD"
										aria-expanded={Boolean(timeline.expanded[item.id])}
										onclick={() => (timeline.expanded[item.id] = !timeline.expanded[item.id])}
									>
										{item.detail}
									</Button>
								{:else}
									<p class="detail">{item.detail}</p>
								{/if}
								<p class="sub">
									{#if item.who}
										<span class="who">
											<Avatar
												name={item.who.name}
												color={item.who.color}
												slackId={item.who.slackId}
												size="sm"
												decorative
											/>
											{item.who.name}
										</span>
										<span aria-hidden="true">·</span>
									{/if}
									<time datetime={item.iso} title={item.ago}>{item.whenLabel}</time>
								</p>
								{#if item.changes?.length && timeline.expanded[item.id]}
									<dl class="changes">
										{#each item.changes as change (change.label)}
											<div class="change">
												<dt>{change.label}</dt>
												<dd>
													<del>{change.from}</del>
													<Icon name="arrowR" size={11} />
													<ins>{change.to}</ins>
												</dd>
											</div>
										{/each}
									</dl>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="primary" data-autofocus onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	.failure,
	.filterBar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.loading {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.empty,
	.shown {
		margin: 0;
		color: var(--text-3);
		font-size: var(--text-sm);
	}
	.shown {
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.rows {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		--kind-color: var(--text-3);
		position: relative;
		display: flex;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
	}
	/* the line joining one dot to the next */
	.row:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 24px;
		bottom: 0;
		left: 11px;
		width: 2px;
		background: var(--border);
	}
	.row:last-child {
		padding-bottom: 0;
	}
	.row[data-kind='submitted'],
	.row[data-kind='vmLaunch'],
	.row[data-kind='edit'] {
		--kind-color: var(--color-blue);
	}
	.row[data-kind='approved'] {
		--kind-color: var(--color-green);
	}
	.row[data-kind='changes'] {
		--kind-color: var(--color-orange);
	}
	.row[data-kind='rejected'] {
		--kind-color: var(--color-red);
	}
	.row[data-kind='reverted'],
	.row[data-kind='priority'] {
		--kind-color: var(--color-yellow);
	}
	.dot {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--kind-color) 16%, var(--surface));
		color: var(--kind-color);
	}
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		min-width: 0;
	}
	.detail {
		margin: 0;
		padding-top: 2px;
		color: var(--text);
		font-size: var(--text-sm);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-2);
		font-weight: 600;
	}
	.changes {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		margin: var(--space-1) 0 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}
	.change dt {
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.change dd {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		font-size: var(--text-xs);
		overflow-wrap: anywhere;
	}
	del {
		color: var(--text-3);
	}
	ins {
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	@media (max-width: 700px) {
		.wide {
			display: none;
		}
	}
</style>
