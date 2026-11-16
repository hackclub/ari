<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		dirty: boolean;
		saving?: boolean;
		onSave: () => void;
		onDiscard: () => void;
		message?: string;
		saveLabel?: string;
		discardLabel?: string;
		reserveSpace?: boolean;
	}
	let {
		dirty,
		saving = false,
		onSave,
		onDiscard,
		message = 'You have unsaved changes.',
		saveLabel = 'Save changes',
		discardLabel = 'Discard',
		reserveSpace = true
	}: Props = $props();
</script>

<!-- the live region has to exist before the bar appears or the message is not announced -->
<p class="announcer" role="status">{dirty ? message : ''}</p>

{#if dirty}
	{#if reserveSpace}<div class="spacer"></div>{/if}
	<div class="dock" transition:fly={{ y: 24, duration: prefersReducedMotion.current ? 0 : 220 }}>
		<div class="saveBar" role="group" aria-label="Unsaved changes">
			<Icon name="info" size={17} />
			<span class="message" aria-hidden="true">{message}</span>
			<Button variant="quiet" size="sm" disabled={saving} onclick={onDiscard}>
				{discardLabel}
			</Button>
			<Button variant="primary" icon="check" loading={saving} onclick={onSave}>
				{saveLabel}
			</Button>
		</div>
	</div>
{/if}

<style>
	.announcer {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.spacer {
		/* keeps the last content clear of the bar: its height plus the gap under it */
		height: calc(var(--control-md) + var(--space-3) * 2 + var(--space-5) * 2);
	}
	.dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: var(--space-5);
		z-index: var(--layer-dropdown);
		display: flex;
		justify-content: center;
		padding: 0 var(--space-4);
		pointer-events: none;
	}
	.saveBar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: min(100%, 720px);
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		color: var(--text-3);
		pointer-events: auto;
	}
	.message {
		flex: 1;
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text);
	}
</style>
