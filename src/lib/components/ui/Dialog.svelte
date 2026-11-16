<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLDialogAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './iconPaths';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		icon?: IconName;
		tone?: 'default' | 'danger' | 'ok' | 'warn';
		size?: 'sm' | 'md' | 'lg' | 'media';
		dismissible?: boolean;
		initialFocus?: string;
		closeLabel?: string;
		children: Snippet;
		footer?: Snippet;
		onClose?: () => void;
	}
	let {
		open = $bindable(false),
		title,
		description,
		icon,
		tone = 'default',
		size = 'md',
		dismissible = true,
		initialFocus = '[data-autofocus]',
		closeLabel = 'Close',
		children,
		footer,
		onClose,
		...rest
	}: Props & Omit<HTMLDialogAttributes, 'title' | 'open' | 'children'> = $props();

	const uid = $props.id();
	const framed = $derived(size !== 'media');

	let dialogElement = $state<HTMLDialogElement>();
	let present = $state(false);
	let opener: Element | null = null;

	// runs before the dom update so the content exists by the time showModal looks for focus
	$effect.pre(() => {
		if (open) present = true;
	});

	function dismiss() {
		if (!dismissible) return;
		open = false;
		onClose?.();
	}

	$effect(() => {
		const node = dialogElement;
		if (!node) return;
		if (open && !node.open) {
			opener = document.activeElement;
			node.showModal();
			node.querySelector<HTMLElement>(initialFocus)?.focus();
		} else if (!open && node.open) {
			node.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
			opener = null;
			setTimeout(() => {
				if (!open) present = false;
			}, 200); // 200ms: the longest close transition in the styles below
		}
	});

	$effect(() => {
		const node = dialogElement;
		if (!node) return;
		let pressedBackdrop = false;
		// the dialog element fills the viewport, so it is the target only for presses outside the panel
		const onPress = (event: PointerEvent) => {
			pressedBackdrop = event.target === node;
		};
		const onClick = (event: MouseEvent) => {
			if (pressedBackdrop && event.target === node) dismiss();
			pressedBackdrop = false;
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !dismissible) event.preventDefault();
		};
		node.addEventListener('pointerdown', onPress);
		node.addEventListener('click', onClick);
		node.addEventListener('keydown', onKey);
		return () => {
			node.removeEventListener('pointerdown', onPress);
			node.removeEventListener('click', onClick);
			node.removeEventListener('keydown', onKey);
		};
	});

	function onCancel(event: Event) {
		if (event.target !== dialogElement) return;
		event.preventDefault();
		dismiss();
	}

	// some browsers force-close on a second Escape even when cancel was prevented
	function onNativeClose() {
		if (!open) return;
		if (dismissible) dismiss();
		else dialogElement?.showModal();
	}
</script>

<dialog
	bind:this={dialogElement}
	class={['dialog', size]}
	aria-labelledby={framed ? `${uid}-title` : undefined}
	aria-label={framed ? undefined : title}
	aria-describedby={framed && description ? `${uid}-description` : undefined}
	oncancel={onCancel}
	onclose={onNativeClose}
	{...rest}
>
	{#if present}
		<div class={['panel', tone]}>
			{#if framed}
				<header>
					{#if icon}<span class="iconTile"><Icon name={icon} size={18} /></span>{/if}
					<div class="heading">
						<h2 id="{uid}-title">{title}</h2>
						{#if description}<p id="{uid}-description">{description}</p>{/if}
					</div>
					{#if dismissible}
						<button type="button" class="close" aria-label={closeLabel} onclick={dismiss}>
							<Icon name="x" size={18} />
						</button>
					{/if}
				</header>
			{/if}
			<div class="body">{@render children()}</div>
			{#if footer}<footer>{@render footer()}</footer>{/if}
		</div>
	{/if}
</dialog>

<style>
	:global(html:has(dialog:modal)) {
		overflow: hidden;
	}
	.dialog {
		position: fixed;
		inset: 0;
		z-index: var(--layer-dialog);
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: var(--space-4);
		border: 0;
		background: transparent;
		color: var(--text);
		place-items: center;
		opacity: 0;
		transition:
			opacity 0.16s,
			overlay 0.2s allow-discrete,
			display 0.2s allow-discrete;
	}
	.dialog[open] {
		display: grid;
		opacity: 1;
	}
	.dialog::backdrop {
		background: color-mix(in srgb, black 55%, transparent);
		opacity: 0;
		transition:
			opacity 0.16s,
			overlay 0.2s allow-discrete,
			display 0.2s allow-discrete;
	}
	.dialog[open]::backdrop {
		opacity: 1;
	}
	.dialog:focus-visible {
		box-shadow: none;
	}

	.panel {
		--tone: var(--primary);
		display: flex;
		flex-direction: column;
		width: min(480px, 100%);
		max-height: calc(100dvh - 2 * var(--space-4));
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		transform: scale(0.96);
		transition: transform 0.2s cubic-bezier(0.2, 0.7, 0.3, 1);
	}
	.dialog[open] .panel {
		transform: none;
	}
	@starting-style {
		.dialog[open],
		.dialog[open]::backdrop {
			opacity: 0;
		}
		.dialog[open] .panel {
			transform: scale(0.96);
		}
	}
	.sm .panel {
		width: min(400px, 100%);
	}
	.lg .panel {
		width: min(780px, 100%);
	}
	.media .panel {
		width: auto;
		max-width: 100%;
		overflow: visible;
		border: 0;
		background: transparent;
		box-shadow: none;
	}
	.danger {
		--tone: var(--color-red);
	}
	.ok {
		--tone: var(--color-green);
	}
	.warn {
		--tone: var(--color-orange);
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.iconTile {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--control-md);
		height: var(--control-md);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--tone) 14%, transparent);
		color: var(--tone);
	}
	.heading {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
		line-height: 1.3;
	}
	.heading p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		line-height: 1.45;
		color: var(--text-2);
	}
	.close {
		display: grid;
		place-items: center;
		flex: none;
		padding: var(--space-1);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}
	.close:hover {
		background: var(--surface-3);
		color: var(--text);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-height: 0;
		padding: var(--space-4);
		overflow: auto;
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	.media .body {
		padding: 0;
		overflow: visible;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--border);
		background: var(--surface-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.dialog,
		.dialog::backdrop,
		.panel {
			transition: none;
		}
	}
</style>
