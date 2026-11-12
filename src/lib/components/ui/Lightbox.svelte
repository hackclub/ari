<script lang="ts" module>
	export interface LightboxItem {
		src: string;
		alt: string;
		kind?: 'image' | 'video';
		caption?: string;
		captionsSrc?: string;
	}
</script>

<script lang="ts">
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		open?: boolean;
		items: LightboxItem[];
		index?: number;
		onClose?: () => void;
	}
	let { open = $bindable(false), items, index = $bindable(0), onClose }: Props = $props();

	const current = $derived(items[Math.min(index, items.length - 1)]);
	const several = $derived(items.length > 1);

	function step(delta: number) {
		index = (index + delta + items.length) % items.length;
	}

	function onKey(event: KeyboardEvent) {
		// a focused video uses the arrow keys to seek
		if (!open || !several || event.target instanceof HTMLVideoElement) return;
		if (event.key === 'ArrowLeft') step(-1);
		else if (event.key === 'ArrowRight') step(1);
		else return;
		event.preventDefault();
	}

	function close() {
		open = false;
		onClose?.();
	}
</script>

<svelte:window onkeydown={onKey} />

<Dialog bind:open title={current?.alt || 'Media viewer'} size="media" {onClose}>
	{#if current}
		<div class="lightbox">
			<figure>
				{#key current.src}
					{#if current.kind === 'video' && current.captionsSrc}
						<video src={current.src} controls controlslist="nodownload" autoplay>
							<track kind="captions" src={current.captionsSrc} default />
						</video>
					{:else if current.kind === 'video'}
						<!-- muted: browsers only autoplay silent video, and it has no captions to offer -->
						<video src={current.src} controls controlslist="nodownload" autoplay muted></video>
					{:else}
						<img src={current.src} alt={current.alt} referrerpolicy="no-referrer" />
					{/if}
				{/key}
				{#if current.caption}<figcaption>{current.caption}</figcaption>{/if}
			</figure>
			<div class="bar">
				{#if several}
					<Button size="sm" icon="arrowL" aria-label="Previous" onclick={() => step(-1)} />
					<span class="count" aria-live="polite">{index + 1} / {items.length}</span>
					<Button size="sm" icon="arrowR" aria-label="Next" onclick={() => step(1)} />
				{/if}
				<span class="spacer"></span>
				<Button size="sm" icon="x" data-autofocus onclick={close}>Close</Button>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	.lightbox {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
		min-width: min(320px, 100%);
	}
	figure {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		margin: 0;
	}
	img,
	video {
		display: block;
		max-width: calc(100vw - 2 * var(--space-4));
		/* leaves room for the caption, the bar and the dialog padding */
		max-height: calc(100dvh - 3 * var(--space-7));
		border-radius: var(--radius-lg);
		object-fit: contain;
		box-shadow: var(--shadow-lg);
	}
	video {
		background: black;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	figcaption {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.spacer {
		flex: 1;
	}
</style>
