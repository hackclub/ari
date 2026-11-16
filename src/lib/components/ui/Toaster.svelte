<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, fly } from 'svelte/transition';
	import { toast } from '$lib/toast.svelte';
	import Icon from './Icon.svelte';

	const still = $derived(prefersReducedMotion.current);

	let region = $state<HTMLElement>();
	let homeParent: ParentNode | null = null;
	const modalStack: HTMLDialogElement[] = [];

	// everything outside a modal dialog is inert, top-layer popovers included, so while one is open
	// the region lives inside the newest modal. it is moved, never re-created, to stay a live region
	function rehome() {
		if (!region || !homeParent) return;
		const host =
			modalStack.findLast((dialog) => dialog.isConnected && dialog.matches(':modal')) ?? homeParent;
		if (region.parentNode !== host) host.appendChild(region);
	}

	$effect(() => {
		const node = region;
		if (!node) return;
		homeParent = node.parentNode;
		modalStack.push(...document.querySelectorAll<HTMLDialogElement>('dialog:modal'));
		const observer = new MutationObserver((records) => {
			let stackChanged = false;
			for (const record of records) {
				const dialog = record.target;
				if (record.type !== 'attributes' || !(dialog instanceof HTMLDialogElement)) continue;
				const index = modalStack.indexOf(dialog);
				if (index !== -1) modalStack.splice(index, 1);
				if (dialog.matches(':modal')) modalStack.push(dialog);
				stackChanged = true;
			}
			// a dialog unmounted while open (a navigation, an {#if}) never flips its open attribute:
			// it just leaves the document and takes the region with it
			if (stackChanged || !node.isConnected) rehome();
		});
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ['open'],
			childList: true,
			subtree: true
		});
		rehome();
		return () => observer.disconnect();
	});

	// the observer runs a microtask after the removal: a toast raised in between must not wait for it
	$effect.pre(() => {
		if (toast.items.length && region && !region.isConnected) rehome();
	});
</script>

<div class="toaster" aria-live="polite" bind:this={region}>
	{#each toast.items as item (item.id)}
		<div
			class={['toast', item.tone]}
			role={item.tone === 'error' ? 'alert' : 'status'}
			animate:flip={{ duration: still ? 0 : 220 }}
			in:fly={{ y: -14, duration: still ? 0 : 260 }}
			out:fade={{ duration: still ? 0 : 160 }}
			onmouseenter={() => toast.pause(item.id)}
			onmouseleave={() => toast.resume(item.id)}
			onfocusin={() => toast.pause(item.id)}
			onfocusout={() => toast.resume(item.id)}
		>
			<span class="icon"><Icon name={item.icon} size={15} strokeWidth={2.4} /></span>
			<span class="message">{item.message}</span>
			<button
				type="button"
				aria-label="Dismiss notification"
				onclick={() => toast.dismiss(item.id)}
			>
				<Icon name="x" size={15} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		top: var(--space-4);
		left: 50%;
		z-index: var(--layer-toast);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		width: max-content;
		max-width: calc(100vw - var(--space-4) * 2);
		transform: translateX(-50%);
		pointer-events: none;
	}
	.toast {
		--tone: var(--color-green);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 200px;
		max-width: 360px;
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		pointer-events: auto;
	}
	.info {
		--tone: var(--color-blue);
	}
	.error {
		--tone: var(--color-red);
	}
	.icon {
		display: grid;
		place-content: center;
		flex: none;
		width: var(--space-5);
		height: var(--space-5);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--tone) 18%, var(--surface));
		color: var(--tone);
	}
	.message {
		flex: 1;
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.35;
		color: var(--text);
		overflow-wrap: anywhere;
	}
	button {
		display: grid;
		place-content: center;
		flex: none;
		width: var(--space-5);
		height: var(--space-5);
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}
	button:hover {
		background: var(--surface-3);
		color: var(--text);
	}
</style>
