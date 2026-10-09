<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'raised' | 'flat';
		padded?: boolean;
		children: Snippet;
	}
	let { variant = 'raised', padded = true, children }: Props = $props();
</script>

<div class={['card', variant, padded && 'padded']}>{@render children()}</div>

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: clip;
	}
	.raised {
		box-shadow: var(--shadow);
	}
	.flat {
		border-radius: var(--radius-md);
	}
	.padded {
		padding: var(--space-4);
	}
</style>
