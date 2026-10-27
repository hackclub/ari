<script lang="ts">
	interface Props {
		color: string;
		src?: string | null;
		size?: 'sm' | 'md';
	}
	let { color, src, size = 'md' }: Props = $props();

	let failedSource = $state<string | null>(null);
	let imageElement = $state<HTMLImageElement>();

	// an image that failed before hydration never fires onerror for us
	$effect(() => {
		if (imageElement?.complete && imageElement.naturalWidth === 0) failedSource = src ?? null;
	});
</script>

{#if src && failedSource !== src}
	<img
		class={['swatch', size]}
		{src}
		alt=""
		referrerpolicy="no-referrer"
		bind:this={imageElement}
		onerror={() => (failedSource = src ?? null)}
	/>
{:else}
	<!-- eslint-disable-next-line svelte/no-inline-styles -- the one place a data-driven colour is applied -->
	<span class={['swatch', size]} style:background={color}></span>
{/if}

<style>
	.swatch {
		display: inline-block;
		flex: none;
		width: var(--space-6);
		height: var(--space-6);
		border-radius: var(--radius-sm);
		object-fit: cover;
	}
	.sm {
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--space-1);
	}
</style>
