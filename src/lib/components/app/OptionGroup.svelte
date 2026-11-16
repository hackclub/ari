<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		nested?: boolean;
		children: Snippet;
	}
	let { label, nested = false, children }: Props = $props();
</script>

<fieldset class={{ nested }}>
	<legend class={{ hidden: nested }}>{label}</legend>
	<div class="options">{@render children()}</div>
</fieldset>

<style>
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.nested {
		margin-left: var(--space-3);
		padding-left: var(--space-4);
		border-left: 2px solid var(--surface-3);
	}
	legend {
		margin-bottom: var(--space-2);
		padding: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.hidden {
		position: absolute;
		overflow: hidden;
		width: 1px;
		height: 1px;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
