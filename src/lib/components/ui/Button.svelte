<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	type Variant = 'primary' | 'ghost' | 'soft' | 'quiet' | 'ok' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	interface Props {
		variant?: Variant;
		size?: Size;
		block?: boolean;
		icon?: IconName;
		iconAfter?: IconName;
		href?: string;
		loading?: boolean;
		children?: Snippet;
	}
	let {
		variant = 'ghost',
		size = 'md',
		block = false,
		icon,
		iconAfter,
		href,
		loading = false,
		children,
		...rest
	}: Props & HTMLButtonAttributes & HTMLAnchorAttributes = $props();

	const iconSize = $derived(size === 'lg' ? 18 : 16);
	const classes = $derived(['button', variant, size, block && 'block', loading && 'loading']);
</script>

{#snippet content()}
	{#if icon}<Icon name={icon} size={iconSize} />{/if}
	{@render children?.()}
	{#if iconAfter}<Icon name={iconAfter} size={iconSize} />{/if}
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass an already-resolved path or an external url -->
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render content()}</a>
{:else}
	<button
		type="button"
		class={classes}
		aria-busy={loading}
		{...rest as HTMLButtonAttributes}
		disabled={loading || (rest as HTMLButtonAttributes).disabled}
	>
		{@render content()}
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		height: var(--control-md);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
		transition:
			transform 0.12s cubic-bezier(0.2, 0.7, 0.3, 1),
			box-shadow 0.15s,
			background 0.15s,
			border-color 0.15s;
	}
	.button:active {
		transform: translateY(1px);
	}
	.button:disabled {
		opacity: 0.5;
		cursor: default;
		transform: none;
	}
	.loading {
		cursor: progress;
	}

	.sm {
		height: var(--control-sm);
		padding: 0 var(--space-2);
		font-size: var(--text-xs);
	}
	.lg {
		height: var(--control-lg);
		padding: 0 var(--space-4);
		font-size: var(--text-md);
	}
	.block {
		width: 100%;
	}

	.primary {
		background: var(--primary);
		color: var(--on-primary);
	}
	.primary:hover:not(:disabled),
	.ok:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.ghost {
		background: var(--surface);
		color: var(--text);
		border-color: var(--border-2);
		box-shadow: var(--shadow-sm);
	}
	.ghost:hover:not(:disabled) {
		background: var(--surface-2);
	}
	.soft {
		background: var(--primary-soft);
		color: var(--primary);
	}
	.quiet {
		background: transparent;
		color: var(--text-2);
	}
	.quiet:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--text);
	}
	.ok {
		background: var(--color-green);
		color: var(--on-ok);
	}
	.danger {
		background: var(--surface);
		color: var(--color-red);
		border-color: color-mix(in srgb, var(--color-red) 35%, transparent);
	}
	.danger:hover:not(:disabled) {
		background: var(--primary-soft);
	}
	/* after the variants: their resting shadow would otherwise replace the global focus ring */
	.button:focus-visible {
		box-shadow: 0 0 0 4px var(--ring);
	}
</style>
