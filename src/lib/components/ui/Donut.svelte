<script lang="ts" module>
	import type { StackedBarTone } from './StackedBar.svelte';

	export interface DonutSegment {
		label: string;
		value: number;
		tone: StackedBarTone;
	}
</script>

<script lang="ts">
	import { theme } from '$lib/theme.svelte';

	interface Props {
		label: string;
		segments: DonutSegment[];
		caption?: string;
		size?: 'md' | 'lg';
	}
	let { label, segments, caption = 'total', size = 'md' }: Props = $props();

	const total = $derived(segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0));

	let canvasElement = $state<HTMLCanvasElement>();
	// never read inside the chart effect, or the chart would rebuild on every hover
	let hovered = $state(false);

	$effect(() => {
		const canvas = canvasElement;
		if (!canvas) return;
		// a canvas cannot read css variables, so tokens are resolved here and again on a theme change
		void theme.revision;
		const styles = getComputedStyle(canvas);
		const token = (name: string) => styles.getPropertyValue(name).trim();
		const toneColor = (tone: StackedBarTone) =>
			token(tone === 'neutral' ? '--text-3' : `--color-${tone}`);
		const shownSegments = segments;
		const shownTotal = total;
		const empty = shownTotal === 0;

		let cancelled = false;
		let destroy = () => {};
		import('chart.js').then((chartModule) => {
			if (cancelled) return;
			const { Chart, DoughnutController, ArcElement, Tooltip } = chartModule;
			Chart.register(DoughnutController, ArcElement, Tooltip);
			const chart = new Chart(canvas, {
				type: 'doughnut',
				data: {
					labels: empty ? [''] : shownSegments.map((segment) => segment.label),
					datasets: [
						{
							// all zeroes would draw nothing, so an empty chart is one flat ring
							data: empty ? [1] : shownSegments.map((segment) => segment.value),
							backgroundColor: empty
								? [token('--surface-3')]
								: shownSegments.map((segment) => toneColor(segment.tone)),
							borderColor: token('--surface'),
							borderWidth: 3,
							hoverOffset: 6,
							borderRadius: 3
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '66%',
					animation: { duration: 450 },
					onHover: (_event, elements) => (hovered = !empty && elements.length > 0),
					plugins: {
						legend: { display: false },
						tooltip: {
							enabled: !empty,
							backgroundColor: token('--surface'),
							titleColor: token('--text'),
							bodyColor: token('--text-2'),
							borderColor: token('--border'),
							borderWidth: 1,
							padding: 10,
							cornerRadius: 10,
							displayColors: true,
							boxPadding: 4,
							callbacks: {
								label: (context) => {
									const value = Number(context.parsed) || 0;
									const percent = shownTotal ? Math.round((value / shownTotal) * 100) : 0;
									return ` ${value} (${percent}%)`;
								}
							}
						}
					}
				}
			});
			destroy = () => chart.destroy();
		});

		return () => {
			cancelled = true;
			destroy();
		};
	});
</script>

<div class={['donut', size]} role="img" aria-label={label}>
	<canvas bind:this={canvasElement}></canvas>
	<div class={{ center: true, faded: hovered }} aria-hidden="true">
		<span class="total">{total}</span>
		<span class="caption">{caption}</span>
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
	/* pointer events stay off so hover still reaches the arcs underneath */
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		transition: opacity 0.12s ease;
	}
	.faded {
		opacity: 0;
	}
	.total {
		font-family: var(--font-mono);
		font-size: var(--text-2xl);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
		color: var(--text);
	}
	.caption {
		font-size: var(--text-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
</style>
