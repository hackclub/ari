<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { placeFloating, type FloatingAlign, type FloatingSide } from './floating';

	interface Props {
		open?: boolean;
		side?: FloatingSide;
		align?: FloatingAlign;
		block?: boolean;
		anchor: Snippet;
		children: Snippet<[() => void]>;
		onOpen?: () => void;
		onClose?: () => void;
	}
	let {
		open = $bindable(false),
		side = 'bottom',
		align = 'start',
		block = false,
		anchor,
		children,
		onOpen,
		onClose,
		...rest
	}: Props & Omit<HTMLAttributes<HTMLDivElement>, 'children'> = $props();

	let anchorElement = $state<HTMLSpanElement>();
	let panelElement = $state<HTMLDivElement>();

	function close(refocus: boolean) {
		if (!open) return;
		open = false;
		onClose?.();
		if (refocus) {
			anchorElement?.querySelector<HTMLElement>('button, a[href], input, [tabindex]')?.focus();
		}
	}

	$effect(() => {
		const anchorNode = anchorElement;
		const panelNode = panelElement;
		if (!open || !anchorNode || !panelNode) return;

		panelNode.showPopover();
		const place = () => placeFloating(anchorNode, panelNode, side, align);
		place();
		untrack(() => onOpen?.());

		const onPress = (event: PointerEvent) => {
			const target = event.target as Node;
			if (anchorNode.contains(target) || panelNode.contains(target)) return;
			close(panelNode.contains(document.activeElement));
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			// keeps a surrounding dialog from closing on the same key press
			event.preventDefault();
			event.stopPropagation();
			close(true);
		};
		const onFocusOut = (event: FocusEvent) => {
			const next = event.relatedTarget as Node | null;
			if (!next || anchorNode.contains(next) || panelNode.contains(next)) return;
			close(false);
		};

		const onScroll = (event: Event) => {
			// scrolling inside the panel does not move the anchor
			if (event.target instanceof Node && panelNode.contains(event.target)) return;
			place();
		};

		document.addEventListener('pointerdown', onPress, true);
		document.addEventListener('keydown', onKey, true);
		anchorNode.addEventListener('focusout', onFocusOut);
		panelNode.addEventListener('focusout', onFocusOut);
		window.addEventListener('resize', place);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			document.removeEventListener('pointerdown', onPress, true);
			document.removeEventListener('keydown', onKey, true);
			anchorNode.removeEventListener('focusout', onFocusOut);
			panelNode.removeEventListener('focusout', onFocusOut);
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', onScroll, true);
			if (panelNode.isConnected && panelNode.matches(':popover-open')) panelNode.hidePopover();
		};
	});
</script>

<span class={{ anchor: true, block }} bind:this={anchorElement}>{@render anchor()}</span>
<div class="panel" popover="manual" tabindex="-1" bind:this={panelElement} {...rest}>
	{#if open}{@render children(() => close(true))}{/if}
</div>

<style>
	.anchor {
		display: inline-flex;
		max-width: 100%;
	}
	.block {
		display: flex;
	}
	.block > :global(*) {
		flex: 1;
	}
	.panel {
		position: fixed;
		inset: auto;
		z-index: var(--layer-dropdown);
		margin: 0;
		padding: 0;
		overflow: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-lg);
		outline: none;
		transform-origin: top;
		transition:
			opacity 0.15s,
			transform 0.15s cubic-bezier(0.2, 0.7, 0.3, 1);
	}
	.panel:global([data-side='top']) {
		transform-origin: bottom;
	}
	.panel:focus-visible {
		box-shadow: var(--shadow-lg);
	}
	@starting-style {
		.panel:popover-open {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.panel {
			transition: none;
		}
	}
</style>
