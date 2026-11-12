<script lang="ts" module>
	export interface AvatarPerson {
		name: string;
		slackId?: string | null;
		color?: string;
	}
</script>

<script lang="ts">
	import Avatar from './Avatar.svelte';

	interface Props {
		people: AvatarPerson[];
		max?: number;
		size?: 'sm' | 'md' | 'lg';
	}
	let { people, max = 4, size = 'md' }: Props = $props();

	const visible = $derived(people.slice(0, max));
	const hidden = $derived(people.slice(max));
	const names = $derived(people.map((person) => person.name).join(', '));
</script>

<span class={['avatarStack', size]} role="img" aria-label={names} title={names}>
	{#each visible as person, index (index)}
		<span class="ring"
			><Avatar
				name={person.name}
				slackId={person.slackId}
				color={person.color}
				{size}
				decorative
			/></span
		>
	{/each}
	{#if hidden.length}<span class="more">+{hidden.length}</span>{/if}
</span>

<style>
	.avatarStack {
		--overlap: var(--space-2);
		display: inline-flex;
		align-items: center;
	}
	.sm {
		--overlap: 6px;
	}
	.lg {
		--overlap: var(--space-3);
	}
	.ring,
	.more {
		display: inline-flex;
		border-radius: var(--radius-full);
		box-shadow: 0 0 0 2px var(--surface);
	}
	.ring + .ring,
	.more {
		margin-left: calc(-1 * var(--overlap));
	}
	.more {
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 var(--space-1);
		background: var(--surface-3);
		color: var(--text-2);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.sm .more {
		min-width: 22px;
		height: 22px;
	}
	.lg .more {
		min-width: 44px;
		height: 44px;
		font-size: var(--text-sm);
	}
</style>
