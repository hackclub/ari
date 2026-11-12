<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		name: string;
		slackId?: string | null;
		src?: string | null;
		color?: string;
		size?: 'sm' | 'md' | 'lg';
		decorative?: boolean;
	}
	let { name, slackId, src, color, size = 'md', decorative = false }: Props = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	// light swatches (yellow, mint, orange) need dark initials; only hex colours can be measured
	const darkInk = $derived.by(() => {
		const match = /^#([0-9a-f]{6})$/i.exec(color ?? '');
		if (!match) return false;
		const packed = parseInt(match[1], 16);
		const red = packed >> 16;
		const green = (packed >> 8) & 255;
		const blue = packed & 255;
		// rec. 601 luma weights; 153 is 60% of 255
		return 0.299 * red + 0.587 * green + 0.114 * blue > 153;
	});

	const source = $derived(src ?? (slackId ? resolve('/api/avatar/[id]', { id: slackId }) : null));
	let failedSource = $state<string | null>(null);
	let imageElement = $state<HTMLImageElement>();

	// an image that failed before hydration never fires onerror for us
	$effect(() => {
		if (imageElement?.complete && imageElement.naturalWidth === 0) failedSource = source;
	});
</script>

{#if source && failedSource !== source}
	<img
		class={['avatar', size]}
		src={source}
		alt={decorative ? '' : name}
		title={decorative ? undefined : name}
		referrerpolicy="no-referrer"
		bind:this={imageElement}
		onerror={() => (failedSource = source)}
	/>
{:else}
	<!-- eslint-disable svelte/no-inline-styles -- the person's colour comes from data -->
	<span
		class={['avatar', size, darkInk && 'darkInk']}
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : name}
		aria-hidden={decorative || undefined}
		title={decorative ? undefined : name}
		style:--avatar-color={color}
	>
		{initials}
	</span>
	<!-- eslint-enable svelte/no-inline-styles -->
{/if}

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background: var(--avatar-color, var(--primary));
		color: var(--on-primary);
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1;
		object-fit: cover;
		user-select: none;
	}
	.sm {
		width: 22px;
		height: 22px;
	}
	.lg {
		width: 44px;
		height: 44px;
		font-size: var(--text-md);
	}
	.darkInk {
		color: color-mix(in srgb, black 78%, transparent);
	}
</style>
