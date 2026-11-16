<script lang="ts">
	import { Icon } from '$lib/components/ui';

	interface Props {
		label: string;
		text: string;
		internal?: boolean;
	}
	let { label, text, internal = false }: Props = $props();
</script>

<div class="noteQuote">
	<p>
		{#if internal}<Icon name="lock" size={11} />{/if}
		{label}
	</p>
	<blockquote>{text.trim() || '—'}</blockquote>
</div>

<style>
	.noteQuote {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	p {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	blockquote {
		/* about seven lines, then it scrolls */
		max-height: 160px;
		margin: 0;
		padding: var(--space-2) var(--space-3);
		overflow-y: auto;
		border-left: 3px solid var(--border-2);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--text-sm);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
