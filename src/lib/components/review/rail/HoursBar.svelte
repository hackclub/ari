<script lang="ts">
	import { StackedBar, type StackedBarSegment, type StackedBarTone } from '$lib/components/ui';
	import type { TimeSource } from '$lib/review/settlement';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';

	const { settlement } = useReview();

	const tones: Record<TimeSource, StackedBarTone> = {
		hackatime: 'blue',
		journals: 'purple',
		lapse: 'orange',
		program: 'green'
	};

	const segments = $derived<StackedBarSegment[]>([
		...settlement.sourceRows.map((row) => ({
			label: row.label,
			value: row.reportedSeconds,
			tone: tones[row.source]
		})),
		{ label: 'Taken off rows', value: settlement.reducedSeconds, tone: 'neutral' },
		{ label: 'Deflated', value: settlement.deflateSeconds, tone: 'neutral' },
		{ label: settlement.deductionLabel, value: settlement.deductedSeconds, tone: 'neutral' }
	]);
</script>

<StackedBar label="Time by source" {segments} format={formatDuration} legend={false} />
