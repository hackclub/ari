<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'raised' | 'flat';
		padded?: boolean;
		backdrop?: string | null;
		children: Snippet;
	}
	let { variant = 'raised', padded = true, backdrop, children }: Props = $props();

	let failedBackdrop = $state<string | null>(null);
	let backdropElement = $state<HTMLImageElement>();
	const showBackdrop = $derived(Boolean(backdrop) && failedBackdrop !== backdrop);

	// an image that failed before hydration never fires onerror for us
	$effect(() => {
		if (backdropElement?.complete && backdropElement.naturalWidth === 0) {
			failedBackdrop = backdrop ?? null;
		}
	});
</script>

<div class={['card', variant, padded && 'padded', showBackdrop && 'withBackdrop']}>
	{#if showBackdrop}
		<img
			class="backdrop"
			src={backdrop}
			alt=""
			referrerpolicy="no-referrer"
			bind:this={backdropElement}
			onerror={() => (failedBackdrop = backdrop ?? null)}
		/>
	{/if}
	{@render children()}
</div>

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: clip;
	}
	.raised {
		box-shadow: var(--shadow);
	}
	.flat {
		border-radius: var(--radius-md);
	}
	.padded {
		padding: var(--space-4);
	}
	.withBackdrop {
		position: relative;
		isolation: isolate;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.26; /* the old card laid its surface at 74% over the image: 1 - 0.74 */
		pointer-events: none;
	}
</style>
