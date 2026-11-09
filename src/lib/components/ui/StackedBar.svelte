<script lang="ts" module>
	export type StackedBarTone =
		| 'blue'
		| 'green'
		| 'orange'
		| 'purple'
		| 'cyan'
		| 'yellow'
		| 'red'
		| 'neutral';

	export interface StackedBarSegment {
		label: string;
		value: number;
		tone?: StackedBarTone;
	}
</script>

<script lang="ts">
	interface Props {
		label: string;
		segments: StackedBarSegment[];
		format?: (value: number) => string;
		legend?: boolean;
	}
	let { label, segments, format = String, legend = true }: Props = $props();

	const shown = $derived(segments.filter((segment) => segment.value > 0));
	const summary = $derived(
		segments.map((segment) => `${segment.label} ${format(segment.value)}`).join(', ')
	);
</script>

<div class="stackedBar">
	<div class="track" role="img" aria-label={`${label}: ${summary}`}>
		{#each shown as segment (segment.label)}
			<!-- eslint-disable-next-line svelte/no-inline-styles -- the one place a segment takes its data-driven share -->
			<span class={['segment', segment.tone ?? 'neutral']} style:flex-grow={segment.value}></span>
		{/each}
	</div>
	{#if legend}
		<ul class="legend" aria-hidden="true">
			{#each segments as segment (segment.label)}
				<li class={segment.tone ?? 'neutral'}>
					<span class="dot"></span>
					<span class="name">{segment.label}</span>
					<span class="amount">{format(segment.value)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.stackedBar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.track {
		display: flex;
		gap: calc(var(--space-1) / 2);
		height: var(--space-3);
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--surface-3);
	}
	.segment {
		flex-basis: 0;
		min-width: var(--space-1);
		background: var(--tone);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		background: var(--tone);
	}
	.name {
		font-weight: 600;
		color: var(--text-2);
	}
	.amount {
		font-family: var(--font-mono);
		color: var(--text-3);
	}
	.neutral {
		--tone: var(--text-3);
	}
	.blue {
		--tone: var(--color-blue);
	}
	.green {
		--tone: var(--color-green);
	}
	.orange {
		--tone: var(--color-orange);
	}
	.purple {
		--tone: var(--color-purple);
	}
	.cyan {
		--tone: var(--color-cyan);
	}
	.yellow {
		--tone: var(--color-yellow);
	}
	.red {
		--tone: var(--color-red);
	}
</style>
