<script lang="ts">
	import { Icon } from '$lib/components/ui';
	import { trackLabel, type Track } from '$lib/data';

	interface Props {
		track: Track;
	}
	let { track }: Props = $props();
</script>

<span class={['trackPill', track]}>
	<Icon name={track === 'hardware' ? 'config' : 'code'} size={12} />
	{trackLabel(track)}
</span>

<style>
	.trackPill {
		--tone: var(--color-blue);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2) 3px;
		border: 1px solid color-mix(in srgb, var(--tone) 40%, var(--border));
		border-radius: var(--radius-sm);
		color: var(--tone);
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}
	.hardware {
		--tone: var(--color-orange);
	}
</style>
