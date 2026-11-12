<script lang="ts">
	import type { Snippet } from 'svelte';
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Icon } from '$lib/components/ui';
	import type { Track } from '$lib/data';

	interface Props {
		id: string;
		title: string;
		track: Track;
		thumb?: string | null;
		children?: Snippet;
	}
	let { id, title, track, thumb = null, children }: Props = $props();

	let failedThumb = $state<string | null>(null);
	let imageElement = $state<HTMLImageElement>();

	// an image that failed before hydration never fires onerror for us
	$effect(() => {
		if (imageElement?.complete && imageElement.naturalWidth === 0) failedThumb = thumb;
	});
</script>

<span class="shipTitle">
	<span class="thumb">
		{#if thumb && failedThumb !== thumb}
			<img
				src={thumb}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				bind:this={imageElement}
				onerror={() => (failedThumb = thumb)}
			/>
		{:else}
			<Icon name="image" size={16} />
		{/if}
	</span>
	<span class="copy">
		<span class="title" {title}>{title}</span>
		<span class="meta">
			<span class="shipId">{id}</span>
			<TrackPill {track} />
			{@render children?.()}
		</span>
	</span>
</span>

<style>
	.shipTitle {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.thumb {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--space-6);
		height: var(--space-6);
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text-3);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--text);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.shipId {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono);
	}
</style>
