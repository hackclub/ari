<script lang="ts">
	import { BarChart, Card, Donut, type DonutSegment } from '$lib/components/ui';

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const reviewsPerDay = [4, 9, 2, 0, 12, 7, 5];
	const bars = weekdays.map((day, index) => ({
		key: day,
		tick: day,
		value: reviewsPerDay[index],
		title: `${day}: ${reviewsPerDay[index]} reviews`
	}));
	let selected = $state<number | null>(4);

	const statuses: DonutSegment[] = [
		{ label: 'Approved', value: 42, tone: 'green' },
		{ label: 'Changes', value: 9, tone: 'orange' },
		{ label: 'Rejected', value: 4, tone: 'red' },
		{ label: 'Pending', value: 18, tone: 'blue' }
	];
</script>

<h2>Charts</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>BarChart</h3>
			<BarChart label="Reviews per day" {bars} bind:selected />
			<p>
				{selected === null ? 'Hover, focus or tap a bar.' : bars[selected].title}
			</p>
			<BarChart label="Reviews per day, dense" {bars} scaleFloor={20} dense />
		</div>
	</Card>
	<Card>
		<div class="stack">
			<h3>Donut</h3>
			<div class="row">
				<Donut label="Ships by status" segments={statuses} />
				<Donut label="Ships by status, large" segments={statuses} size="lg" caption="ships" />
				<Donut label="Nothing yet" segments={[]} />
			</div>
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
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-5);
	}
</style>
