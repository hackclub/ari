<script lang="ts">
	import { Avatar } from '$lib/components/ui';

	interface Props {
		name: string;
		color?: string;
		slackId?: string | null;
		email?: string;
	}
	let { name, color, slackId = null, email }: Props = $props();
</script>

<span class="mention" title={email}>
	<Avatar {name} {color} {slackId} size="sm" decorative />{name}
</span>

<style>
	.mention {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		max-width: 100%;
		padding: 2px var(--space-2) 2px 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text);
		font-weight: 600;
		line-height: 1;
		vertical-align: middle;
	}
</style>
