<script lang="ts" generics="Value extends string">
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	interface Option {
		value: Value;
		label: string;
		icon?: IconName;
		badgeCount?: number;
		disabled?: boolean;
	}
	interface Props {
		value: Value;
		options: Option[];
		label: string;
		name?: string;
		size?: 'sm' | 'md';
		disabled?: boolean;
		onchange?: (value: Value) => void;
	}
	let {
		value = $bindable(),
		options,
		label,
		name,
		size = 'md',
		disabled = false,
		onchange
	}: Props = $props();

	const uid = $props.id();
</script>

<div class={['segmentedControl', size]} role="radiogroup" aria-label={label}>
	{#each options as option (option.value)}
		<label class="segment">
			<!-- native radios give arrow-key movement and form submission for free -->
			<input
				type="radio"
				name={name ?? uid}
				value={option.value}
				disabled={disabled || option.disabled}
				bind:group={value}
				onchange={() => onchange?.(option.value)}
			/>
			{#if option.icon}<Icon name={option.icon} size={size === 'sm' ? 13 : 15} />{/if}
			<span>{option.label}</span>
			{#if option.badgeCount !== undefined}
				<span class="badgeCount">{option.badgeCount}</span>
			{/if}
		</label>
	{/each}
</div>

<style>
	.segmentedControl {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-md);
		background: var(--surface-3);
	}
	.segment {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		/* control height minus the 3px track padding on each side */
		height: calc(var(--control-md) - 6px);
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		color: var(--text-2);
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s,
			box-shadow 0.12s;
	}
	.sm .segment {
		height: calc(var(--control-sm) - 6px);
		padding: 0 var(--space-2);
		font-size: var(--text-xs);
	}
	.segment:hover {
		color: var(--text);
	}
	.segment:has(input:checked) {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
	.segment:has(input:focus-visible) {
		box-shadow: 0 0 0 3px var(--ring);
	}
	.segment:has(input:disabled) {
		opacity: 0.5;
		cursor: default;
	}
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}
	.badgeCount {
		padding: 2px var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--primary-soft);
		color: var(--primary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	@media (prefers-reduced-motion: reduce) {
		.segment {
			transition: none;
		}
	}
</style>
