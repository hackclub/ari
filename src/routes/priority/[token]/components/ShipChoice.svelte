<script lang="ts">
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Checkbox, Icon } from '$lib/components/ui';
	import type { Track } from '$lib/data';
	import { formatDuration } from '$lib/time';

	interface Ship {
		id: string;
		title: string;
		track: Track;
		processing: boolean;
		ago: string;
		loggedSeconds: number;
		thumbnailUrl: string | null;
		priority: boolean;
	}
	interface Props {
		ship: Ship;
		checked?: boolean;
		onToggle?: () => void;
	}
	let { ship, checked = false, onToggle }: Props = $props();

	let thumbnailFailed = $state(false);
</script>

{#snippet summary()}
	<span class={['summary', ship.priority && 'locked']}>
		<span class="thumbnail">
			{#if ship.thumbnailUrl && !thumbnailFailed}
				<img
					src={ship.thumbnailUrl}
					alt=""
					loading="lazy"
					referrerpolicy="no-referrer"
					onerror={() => (thumbnailFailed = true)}
				/>
			{/if}
		</span>
		<span class="copy">
			<span class="title">{ship.title}</span>
			<span class="meta">
				<TrackPill track={ship.track} />
				{#if ship.priority}
					Already prioritized
				{:else if ship.processing}
					still processing, a mark applies once it queues
				{:else}
					waiting {ship.ago}{ship.loggedSeconds
						? ` · ${formatDuration(ship.loggedSeconds)} logged`
						: ''}
				{/if}
			</span>
		</span>
	</span>
{/snippet}

{#if ship.priority}
	<div class="settled">
		<span class="mark"><Icon name="check" size={14} strokeWidth={3} /></span>
		{@render summary()}
	</div>
{:else}
	<Checkbox name="ship" value={ship.id} {checked} onchange={onToggle}>
		{@render summary()}
	</Checkbox>
{/if}

<style>
	.settled {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}
	/* same footprint as the checkbox, so a settled row lines up with a selectable one */
	.mark {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: 18px;
		height: 18px;
		color: var(--color-yellow);
	}
	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.locked .thumbnail,
	.locked .title {
		opacity: 0.55;
	}
	.thumbnail {
		flex: none;
		width: var(--control-lg);
		height: var(--control-lg);
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-3);
	}
	img {
		display: block;
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
		font-size: var(--text-sm);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-2);
	}
</style>
