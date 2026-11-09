<script lang="ts" module>
	import type { StackedBarTone } from './StackedBar.svelte';

	export interface DonutSegment {
		label: string;
		value: number;
		tone: StackedBarTone;
	}
</script>

<script lang="ts">
	interface Props {
		label: string;
		segments: DonutSegment[];
		caption?: string;
		size?: 'md' | 'lg';
	}
	let { label, segments, caption = 'total', size = 'md' }: Props = $props();

	const total = $derived(segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0));
	const shown = $derived(segments.filter((segment) => segment.value > 0));
	// pathLength is 100, so every length and offset below is a percentage of the ring
	const arcs = $derived.by(() => {
		let start = 0;
		return shown.map((segment) => {
			const length = (segment.value / total) * 100;
			// up to a 1% gap between arcs, at most half a tiny arc so it stays visible
			const gap = shown.length > 1 ? Math.min(1, length / 2) : 0;
			const arc = { segment, start, length: length - gap };
			start += length;
			return arc;
		});
	});

	const summary = $derived(
		segments.map((segment) => `${segment.label} ${segment.value}`).join(', ') +
			` of ${total} ${caption}`
	);

	let hoveredLabel = $state<string | null>(null);
	const hovered = $derived(shown.find((segment) => segment.label === hoveredLabel) ?? null);
</script>

<div class={['donut', size]} role="img" aria-label="{label}: {summary}">
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<!-- r 43: 50 - 12 / 2 for the stroke - 1 so the outer edge is not clipped -->
		<circle
			class="track"
			cx="50"
			cy="50"
			r="43"
			pathLength="100"
			role="presentation"
			onpointerdown={() => (hoveredLabel = null)}
		/>
		{#each arcs as arc (arc.segment.label)}
			<circle
				class={['arc', arc.segment.tone, hovered && hovered !== arc.segment && 'dim']}
				cx="50"
				cy="50"
				r="43"
				pathLength="100"
				stroke-dasharray="{arc.length} {100 - arc.length}"
				stroke-dashoffset={-arc.start}
				role="presentation"
				onpointerenter={() => (hoveredLabel = arc.segment.label)}
				onpointerleave={(event) => {
					// a finger lifting ends the pointer, so a tapped arc stays picked until the next tap
					if (event.pointerType !== 'touch') hoveredLabel = null;
				}}
			/>
		{/each}
	</svg>
	<div class="center" aria-hidden="true">
		<span class="total">{hovered ? hovered.value : total}</span>
		<span class="caption">{hovered ? hovered.label : caption}</span>
		{#if hovered}
			<span class="caption">{Math.round((hovered.value / total) * 100)}%</span>
		{/if}
	</div>
</div>

<style>
	.donut {
		position: relative;
		flex: none;
		width: 132px;
		height: 132px;
	}
	.lg {
		width: 176px;
		height: 176px;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		/* arcs start at twelve o'clock */
		transform: rotate(-90deg);
	}
	circle {
		fill: none;
		stroke-width: 12;
	}
	.track {
		stroke: var(--surface-3);
	}
	.arc {
		stroke: var(--tone);
		transition: opacity 0.12s ease;
	}
	.dim {
		opacity: 0.35;
	}
	/* pointer events stay off so hover still reaches the arcs underneath */
	/* hole radius is 43 - 12 / 2 = 37 of 100, so its edge is 13% in from each side; 16% keeps 3% clear */
	.center {
		position: absolute;
		inset: 0 16%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.total {
		font-family: var(--font-mono);
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.caption {
		max-width: 100%;
		margin-top: var(--space-1);
		overflow: hidden;
		font-size: var(--text-xs);
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-3);
	}
	.caption + .caption {
		margin-top: 0;
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
	@media (prefers-reduced-motion: reduce) {
		.arc {
			transition: none;
		}
	}
</style>
