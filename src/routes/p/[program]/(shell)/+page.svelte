<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import {
		Avatar,
		BarChart,
		Card,
		Donut,
		EmptyState,
		Meter,
		SegmentedControl,
		StatTile,
		type StackedBarTone
	} from '$lib/components/ui';
	import { labelOf, type Status } from '$lib/data';
	import { formatDurationCompact } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusTones: Partial<Record<Status, StackedBarTone>> = {
		pending: 'blue',
		changes: 'orange',
		approved: 'green',
		rejected: 'red'
	};
	const segments = $derived(
		data.byStatus.map((entry) => ({
			label: labelOf(entry.status),
			value: entry.count,
			tone: statusTones[entry.status] ?? 'neutral'
		}))
	);

	let chartRange = $state<'week' | 'month'>('week');
	const days = $derived(chartRange === 'week' ? data.weekly : data.monthly);
	const plural = (count: number) => `${count} review${count === 1 ? '' : 's'}`;
	const bars = $derived(
		days.map((day) => ({
			key: day.date,
			value: day.count,
			tick: day.tick,
			title: `${day.date}: ${plural(day.count)}`
		}))
	);
	let pickedBar = $state<number | null>(null);
	// today is the last bar, and the default pick
	const shownDay = $derived(days[pickedBar ?? days.length - 1] ?? days[days.length - 1]);

	const board = $derived(data.leaderboard);
	const boardMax = $derived(Math.max(1, ...board.map((row) => row.count)));

	const medianReview = $derived(data.stats.medianReviewSeconds);
	const decisionCount = $derived(data.stats.reviewDecisions);
</script>

<svelte:head><title>{data.program} · Overview · Ari</title></svelte:head>

<PageHeader title="Overview" description="How {data.program} reviews are going." />

<div class="stats">
	<StatTile label="Needs review" value={data.stats.needsReview} />
	<StatTile
		label="New today"
		value={data.stats.newToday}
		subLabel="vs {data.stats.reviewedToday} reviewed"
		tone={data.stats.net >= 0 ? 'ok' : 'warn'}
	/>
	<StatTile label="Reviewed today" value={data.stats.reviewedToday} />
	<StatTile
		label="Median review time"
		value={medianReview === null ? '–' : formatDurationCompact(medianReview)}
		subLabel={medianReview === null
			? 'no decisions in the last 30 days'
			: `across ${decisionCount} decision${decisionCount === 1 ? '' : 's'} in 30 days`}
	/>
</div>

<div class="panels">
	<Card>
		<div class="panel">
			<div class="panelHead">
				<div>
					<h2>Reviews completed</h2>
					<p>Last {chartRange === 'week' ? 7 : 30} days · {data.program} team</p>
				</div>
				<SegmentedControl
					label="Chart range"
					size="sm"
					bind:value={chartRange}
					options={[
						{ value: 'week', label: 'Week' },
						{ value: 'month', label: 'Month' }
					]}
					onchange={() => (pickedBar = null)}
				/>
			</div>
			<BarChart
				label="Reviews completed per day"
				{bars}
				scaleFloor={10}
				dense={chartRange === 'month'}
				bind:selected={() => pickedBar ?? days.length - 1, (index) => (pickedBar = index)}
			/>
			<div class="dayDetail" aria-live="polite">
				<span class="dayTitle">{shownDay.date} · {plural(shownDay.count)}</span>
				{#each shownDay.reviewers as reviewer (reviewer.id)}
					<span class="dayReviewer">
						<Avatar
							name={reviewer.name}
							color={reviewer.color}
							slackId={reviewer.slackId}
							size="sm"
							decorative
						/>
						{reviewer.name}
						<span class="amount">{reviewer.count}</span>
					</span>
				{/each}
			</div>
		</div>
	</Card>

	<Card>
		<div class="panel">
			<h2>{data.program} breakdown</h2>
			<div class="breakdown">
				<Donut label="Submission status breakdown" {segments} />
				<ul class="legend">
					{#each segments as segment (segment.label)}
						<li class={segment.tone}>
							<span class="dot"></span>
							<span class="legendName">{segment.label}</span>
							<span class="amount">{segment.value}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</Card>
</div>

<Card>
	<div class="panel">
		<div class="panelHead">
			<div>
				<h2>Reviewer leaderboard</h2>
				<p>Last 30 days</p>
			</div>
		</div>
		{#if board.length === 0}
			<EmptyState title="No reviews in the last 30 days" icon="award" />
		{:else}
			<ol class="board">
				{#each board as row, rank (row.id)}
					<li>
						<span class={{ rank: true, top: rank === 0 }}>{rank + 1}</span>
						<Avatar name={row.name} color={row.color} slackId={row.slackId} size="sm" decorative />
						<div class="boardMeter">
							<Meter
								label={row.name}
								value={row.count}
								max={boardMax}
								valueText={String(row.count)}
								tone="primary"
								layout="inline"
							/>
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</Card>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
	}
	.panels {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-4);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	.panelHead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
	}
	p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.dayDetail {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-height: var(--control-sm);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.dayTitle {
		font-weight: 600;
	}
	.dayReviewer {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-2);
		font-weight: 600;
	}
	.amount {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.breakdown {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-5);
	}
	.legend {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 120px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.legend li {
		--tone: var(--text-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.legend .blue {
		--tone: var(--color-blue);
	}
	.legend .orange {
		--tone: var(--color-orange);
	}
	.legend .green {
		--tone: var(--color-green);
	}
	.legend .red {
		--tone: var(--color-red);
	}
	.dot {
		flex: none;
		width: var(--space-2);
		height: var(--space-2);
		border-radius: 3px;
		background: var(--tone);
	}
	.legendName {
		flex: 1;
		white-space: nowrap;
	}
	.board {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.board li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.board li:last-child {
		border-bottom: 0;
	}
	.rank {
		flex: none;
		width: var(--space-5);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
		text-align: center;
	}
	.top {
		font-weight: 600;
		color: var(--text);
	}
	.boardMeter {
		flex: 1;
		min-width: 0;
	}
	/* a fixed name column keeps every row's bar starting at the same x */
	.boardMeter :global(.copy) {
		flex: none;
		width: 9rem;
		overflow: hidden;
	}
	@media (max-width: 880px) {
		.panels {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
