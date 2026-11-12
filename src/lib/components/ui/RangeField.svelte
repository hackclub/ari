<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		valueLabel?: string;
		valueText?: string;
		onValue?: (value: number) => void;
		onCommit?: (value: number) => void;
	}
	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 1,
		valueLabel,
		valueText,
		onValue,
		onCommit,
		...rest
	}: Props & Omit<HTMLInputAttributes, 'type' | 'value' | 'min' | 'max' | 'step'> = $props();
</script>

<label class="rangeField">
	<span class="head">
		<span>{label}</span>
		<output>{valueLabel ?? value}</output>
	</span>
	<input
		type="range"
		{min}
		{max}
		{step}
		{value}
		aria-valuetext={valueText ?? valueLabel}
		oninput={(event) => {
			value = Number(event.currentTarget.value);
			onValue?.(value);
		}}
		onchange={(event) => onCommit?.(Number(event.currentTarget.value))}
		{...rest}
	/>
</label>

<style>
	.rangeField {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-2);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	output {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--text-3);
		white-space: nowrap;
	}
	input {
		width: 100%;
		min-width: calc(var(--space-7) * 2);
		margin: 0;
		accent-color: var(--color-blue);
		cursor: ew-resize;
	}
</style>
