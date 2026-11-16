<script lang="ts">
	interface Props {
		label: string;
		value: number;
		max: number;
		min?: number;
		valueText?: string;
		tone?: 'primary' | 'ok' | 'warn';
		layout?: 'inline' | 'stacked';
	}
	let { label, value, max, min = 0, valueText, tone, layout = 'stacked' }: Props = $props();

	const span = $derived(max - min);
	const percent = $derived(span > 0 ? Math.min(Math.max(((value - min) / span) * 100, 0), 100) : 0);
	const shownText = $derived(valueText ?? `${value} / ${max}`);
	const shownTone = $derived(tone ?? (value >= max ? 'ok' : 'primary'));
</script>

<div class={['meter', layout, shownTone]}>
	<div class="copy" aria-hidden="true">
		<span class="number">{shownText}</span>
		<span class="label">{label}</span>
	</div>
	<div
		class="track"
		role="meter"
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-valuetext={shownText}
	>
		<!-- eslint-disable-next-line svelte/no-inline-styles -- the one place the fill takes its data-driven width -->
		<span class="fill" style:width={`${percent}%`}></span>
	</div>
</div>

<style>
	.meter {
		--tone: var(--primary);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.inline {
		flex-direction: row;
		align-items: center;
		gap: var(--space-3);
	}
	.ok {
		--tone: var(--color-green);
	}
	.warn {
		--tone: var(--color-orange);
	}
	.copy {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		line-height: 1;
	}
	.inline .track {
		flex: 1;
	}
	.inline .copy {
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
	}
	.number {
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-3);
		white-space: nowrap;
	}
	/* stacked, the track keeps its own height: flex 1 in a column collapses it to zero */
	.track {
		flex: none;
		min-width: var(--space-7);
		height: var(--space-2);
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--surface-3);
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--tone);
		transition: width 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
