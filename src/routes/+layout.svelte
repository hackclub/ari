<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import NamePrompt from '$lib/components/app/NamePrompt.svelte';
	import PrivateOverlay from '$lib/components/app/PrivateOverlay.svelte';
	import { NavProgress, Toaster } from '$lib/components/ui';
	import { customCss } from '$lib/customCss.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	// browser-only preferences live outside the session, so they apply after hydration
	$effect(() => {
		let style = document.getElementById('ari-custom-css');
		if (!style) {
			style = document.createElement('style');
			style.id = 'ari-custom-css';
			document.head.append(style);
		}
		style.textContent = customCss.text;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<NavProgress />
<Toaster />
{#if data.user?.namePending && page.url.pathname !== '/nda'}
	<NamePrompt />
{/if}

{@render children()}

{#if data.privateOverlay}
	<PrivateOverlay data={data.privateOverlay} />
{/if}
