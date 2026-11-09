<script lang="ts">
	import { privateProvider } from '$private';
	import StatusBadge from '$lib/components/app/StatusBadge.svelte';
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Badge, Button, Icon, Lightbox } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import MakerCard from './MakerCard.svelte';
	import ProjectFacts from './ProjectFacts.svelte';

	const { context, keybinds } = useReview();
	const ship = $derived(context.ship);
	const update = $derived(context.data.update);
	const HeaderExtras = privateProvider.slots.reviewHeaderExtras;
	const shipRef = $derived({ submissionId: ship.id, programId: context.programId });

	// long descriptions fold so they do not push the evidence off screen
	let expanded = $state(false);
	const long = $derived((ship.description?.length ?? 0) > 100); // characters shown before folding
	const description = $derived(
		!ship.description
			? ''
			: !long || expanded
				? ship.description
				: `${ship.description.slice(0, 100).trimEnd()}…`
	);

	let coverOpen = $state(false);
	let coverBroken = $state(false);
	const cover = $derived(ship.thumbnailUrl && !coverBroken ? ship.thumbnailUrl : null);

	const openTab = (url: string | null) => {
		if (!url) return false;
		window.open(url, '_blank', 'noopener');
	};

	$effect(() =>
		keybinds.registerShortcuts('project', [
			{
				id: 'repo',
				label: 'Open repo',
				defaultBinding: 'r',
				handler: () => openTab(context.repoUrl || null)
			},
			{
				id: 'demo',
				label: 'Open live demo',
				defaultBinding: 'v',
				handler: () => openTab(ship.demoUrl)
			}
		])
	);
</script>

<section class="projectHeader" data-review-region="projectHeader">
	<div class={{ layout: true, noCover: !cover }}>
		{#if cover}
			<button
				type="button"
				class="cover"
				aria-label="View the full-size cover image"
				onclick={() => (coverOpen = true)}
			>
				<img
					src={cover}
					alt="{ship.title} cover"
					loading="lazy"
					referrerpolicy="no-referrer"
					onerror={() => (coverBroken = true)}
				/>
			</button>
		{/if}
		<div class="summary">
			<h1>{ship.title}</h1>
			<div class="tags">
				<StatusBadge status={ship.status} />
				<TrackPill track={ship.track} />
				{#if ship.priority}<Badge tone="pending">Priority</Badge>{/if}
				{#if update}<Badge>Update · version {ship.version}</Badge>{/if}
				<span class="received">received {ship.ago}{ship.ago === 'now' ? '' : ' ago'}</span>
			</div>
			{#if description}
				<p class="description">{description}</p>
				{#if long}
					<div>
						<Button size="sm" variant="quiet" onclick={() => (expanded = !expanded)}>
							{expanded ? 'Show less' : 'Show more'}
						</Button>
					</div>
				{/if}
			{/if}
			<div class="maker"><MakerCard /></div>
		</div>
		<ProjectFacts />
		{#if HeaderExtras}
			<div class="extras" data-review-region="headerExtras"><HeaderExtras ship={shipRef} /></div>
		{/if}
		{#if update}
			<aside class="update" data-review-region="updateCard">
				<h2><Icon name="bell" size={13} /> This project is an update!</h2>
				<p>{update.message || 'The maker marked this ship as an update.'}</p>
			</aside>
		{/if}
	</div>
</section>

{#if ship.thumbnailUrl}
	<Lightbox
		bind:open={coverOpen}
		items={[{ src: ship.thumbnailUrl, alt: `${ship.title} thumbnail` }]}
	/>
{/if}

<style>
	.projectHeader {
		min-width: 0;
		container: projectHeader / inline-size;
	}
	.layout {
		display: grid;
		grid-template-columns: 240px minmax(0, 1.2fr) minmax(0, 1fr);
		align-items: start;
		gap: var(--space-4) var(--space-5);
		min-width: 0;
	}
	.layout.noCover {
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
	}
	.cover {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		overflow: hidden;
		cursor: zoom-in;
	}
	.cover:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
	.cover img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	h1 {
		min-width: 0;
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.received {
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.description {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	/* lines the avatar up with the text above it: the trigger's own padding is not visible */
	.maker {
		margin-left: calc(var(--space-3) * -1);
	}
	.extras {
		grid-column: 1 / -1;
		min-width: 0;
	}
	/* the private module may have nothing to show for this ship */
	.extras:empty {
		display: none;
	}
	.update {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--color-blue) 30%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-blue) 8%, var(--surface));
	}
	.update h2 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--color-blue);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.update p {
		margin: 0;
		color: var(--text);
		font-size: var(--text-sm);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	/* the header lives beside a rail of any width, so it folds on its own room, not the viewport's */
	/* 1080px: below it the cover leaves the facts column too narrow for a link and its buttons */
	@container projectHeader (max-width: 1080px) {
		.layout:not(.noCover) {
			grid-template-columns: 180px minmax(0, 1fr);
		}
		.layout:not(.noCover) > :global(.facts) {
			grid-column: 1 / -1;
		}
	}
	@container projectHeader (max-width: 900px) {
		.layout.noCover {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@container projectHeader (max-width: 520px) {
		.layout:not(.noCover) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
