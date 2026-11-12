<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { visibleAdminSections } from '$lib/adminNav';
	import { Button } from '$lib/components/ui';
	import AppFrame from './AppFrame.svelte';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	// entries mirror the per-page server gates: each shows only with its permission
	const tabs = $derived(
		visibleAdminSections(page.data.user?.orgPermissions ?? []).map((section) => ({
			value: section.id,
			label: section.label,
			icon: section.icon,
			href: section.href
		}))
	);
	// the programs board is the section root, so it has no segment of its own
	const active = $derived(page.url.pathname.split('/').filter(Boolean)[1] ?? 'programs');
</script>

<AppFrame {tabs} {active} navLabel="Admin">
	{#snippet lead()}
		<span class="title">Organization</span>
		<Button variant="quiet" size="sm" icon="arrowL" href="/programs">Back to programs</Button>
	{/snippet}
	{@render children()}
</AppFrame>

<style>
	.title {
		font-size: var(--text-md);
		font-weight: 600;
	}
</style>
