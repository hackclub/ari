<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { activeProgramTab, programNavTabs } from '$lib/programNav';
	import AppFrame from './AppFrame.svelte';
	import ProgramSwitcher from './ProgramSwitcher.svelte';
	import SearchBar from './SearchBar.svelte';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	const programId = $derived(page.params.program ?? '');
	const program = $derived(page.data.program ?? '');
	const permissions = $derived(page.data.permissions ?? []);
	const tabs = $derived(
		programNavTabs({
			programId,
			permissions,
			pending: page.data.pending ?? 0,
			secondPass: page.data.meta?.secondPass ?? false,
			secondPassPending: page.data.secondPassPending ?? 0,
			privateTabs: page.data.privateTabs ?? []
		})
	);
	const active = $derived(activeProgramTab(page.url.pathname, programId));
</script>

<AppFrame {tabs} {active} navLabel="Program">
	{#snippet lead()}
		<ProgramSwitcher
			{programId}
			{program}
			color={page.data.meta?.color ?? 'var(--primary)'}
			iconUrl={page.data.meta?.iconUrl ?? null}
			assigned={page.data.assignedPrograms ?? []}
			orgWide={page.data.orgWide === true}
		/>
		<div class="search"><SearchBar {programId} {program} {tabs} /></div>
	{/snippet}
	{@render children()}
</AppFrame>

<style>
	.search {
		flex: 1;
		min-width: 0;
		max-width: 380px;
	}
</style>
