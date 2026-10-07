<script lang="ts">
	import Logo from '$lib/components/app/Logo.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import UserMenu from '$lib/components/app/UserMenu.svelte';
	import McpTokens from '$lib/components/app/mcp/McpTokens.svelte';
	import { Button } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let mintOpen = $state(false);
</script>

<svelte:head><title>MCP · Ari</title></svelte:head>

<div class="topBar">
	<Logo />
	<UserMenu />
</div>

<main class="mcp">
	<PageHeader
		title="MCP and API tokens"
		description="Connect Claude or a script to Ari. A token acts as you: it sees and changes only what you can in the app, and you can limit it to some of your programs or to read-only."
	>
		{#snippet actions()}
			<Button icon="book" href="/docs/mcp">Docs</Button>
			<Button variant="primary" icon="plus" onclick={() => (mintOpen = true)}>New token</Button>
		{/snippet}
	</PageHeader>

	<McpTokens
		tokens={data.tokens}
		endpoint={data.endpoint}
		programs={data.programs}
		ownerEmail={data.user?.email ?? ''}
		bind:mintOpen
	/>
</main>

<style>
	.topBar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
	}
	.mcp {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-5) var(--space-4) var(--space-7);
	}
</style>
