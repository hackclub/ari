<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import McpTokens from '$lib/components/app/mcp/McpTokens.svelte';
	import { Button } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let mintOpen = $state(false);
</script>

<svelte:head><title>MCP · Admin · Ari</title></svelte:head>

<PageHeader
	title="MCP access"
	description="Every token in the org. Each acts as its owner and never reaches further than that person can. Revoke any of them here; people manage their own on their MCP page."
>
	{#snippet actions()}
		<Button variant="primary" icon="plus" onclick={() => (mintOpen = true)}>New token</Button>
	{/snippet}
</PageHeader>

<McpTokens
	tokens={data.tokens}
	endpoint={data.endpoint}
	programs={data.programs}
	ownerEmail={data.user?.email ?? ''}
	showOwner
	bind:mintOpen
/>
