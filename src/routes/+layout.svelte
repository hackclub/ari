<script lang="ts">
	import './layout.css';
	import { asset } from '$app/paths';
	import NamePrompt from '$lib/components/app/NamePrompt.svelte';
	import PrivateOverlay from '$lib/components/app/PrivateOverlay.svelte';
	import { NavProgress, Toaster } from '$lib/components/ui';
	import { page } from '$app/state';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={asset('/favicon.svg')} type="image/svg+xml" /></svelte:head>

<NavProgress />
<Toaster />
{#if data.user?.namePending && page.url.pathname !== '/nda'}
	<NamePrompt />
{/if}

{@render children()}

{#if data.privateOverlay}
	<PrivateOverlay data={data.privateOverlay} />
{/if}
