<script lang="ts">
	import AppFrame from '$lib/components/app/AppFrame.svelte';
	import { Button } from '$lib/components/ui';

	let { children } = $props();
</script>

<AppFrame tabs={[]} active="" navLabel="Settings">
	{#snippet lead()}
		<span class="title">Settings</span>
		<Button variant="quiet" size="sm" icon="arrowL" href="/programs">Back to programs</Button>
	{/snippet}
	{@render children()}
</AppFrame>

<style>
	.title {
		font-size: var(--text-md);
		font-weight: 800;
		letter-spacing: -0.02em;
	}
</style>
