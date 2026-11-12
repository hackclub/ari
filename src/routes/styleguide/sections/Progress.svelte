<script lang="ts">
	import { formatDuration } from '$lib/time';
	import {
		Button,
		Card,
		Meter,
		ProgressBar,
		Skeleton,
		StackedBar,
		type StackedBarSegment
	} from '$lib/components/ui';

	let reviewed = $state(13);

	const hoursBySource: StackedBarSegment[] = [
		{ label: 'Hackatime', value: 30960, tone: 'blue' },
		{ label: 'Journals', value: 9000, tone: 'green' },
		{ label: 'Lapse', value: 4320, tone: 'purple' },
		{ label: 'Program', value: 840, tone: 'orange' }
	];
</script>

<h2>Progress</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>Skeleton</h3>
			<div class="row">
				<Skeleton shape="circle" />
				<div class="lines">
					<Skeleton width="60%" />
					<Skeleton width="35%" />
				</div>
			</div>
			<Skeleton shape="block" />
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Meter</h3>
			<div class="columns">
				<Meter label="Weekly goal" value={reviewed} max={20} valueText={`${reviewed} / 20 ships`} />
				<Meter
					label="Weekly goal"
					layout="inline"
					value={reviewed}
					max={20}
					valueText={`${reviewed} / 20`}
				/>
				<Meter
					label="Queue budget"
					tone="warn"
					value={16200}
					max={18000}
					valueText={`${formatDuration(16200)} of ${formatDuration(18000)}`}
				/>
			</div>
			<div class="row">
				<Button size="sm" onclick={() => (reviewed = Math.max(reviewed - 1, 0))}>One fewer</Button>
				<Button size="sm" onclick={() => (reviewed = Math.min(reviewed + 1, 20))}>One more</Button>
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>ProgressBar</h3>
			<ProgressBar label="Importing ships" value={reviewed} max={20} />
			<ProgressBar label="Upload" value={100} tone="ok" size="sm" />
			<ProgressBar label="Waiting for the server" />
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>StackedBar</h3>
			<StackedBar label="Hours by source" segments={hoursBySource} format={formatDuration} />
			<StackedBar
				label="Hours by source, no legend"
				segments={hoursBySource.slice(0, 2)}
				format={formatDuration}
				legend={false}
			/>
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
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.lines {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-2);
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-5);
		align-items: center;
	}
</style>
