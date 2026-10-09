<script lang="ts">
	import { Button, Card, Notice, TextField } from '$lib/components/ui';

	let { data, form } = $props();

	// a failed submit carries the oauth params back, otherwise they come from the load
	const params = $derived(form?.params ?? data.params);
	const client = $derived(form?.client ?? data.client);
	const errorMessage = $derived(form?.error ?? null);

	const hiddenParams = [
		'client_id',
		'redirect_uri',
		'response_type',
		'state',
		'code_challenge',
		'code_challenge_method',
		'scope',
		'resource'
	] as const;
</script>

<svelte:head><title>Connect to ari · MCP</title></svelte:head>

<main class="authorize">
	<div class="panel">
		<Card>
			<form method="POST">
				<header class="who">
					<h1>Connect <strong>{client.name}</strong> to ari</h1>
					<p>
						After you authorize, an access code is sent to
						<strong class="host">{client.redirectHost}</strong>. Only continue if that is where you
						started this connection.
					</p>
				</header>

				{#if errorMessage}
					<Notice tone="danger">{errorMessage}</Notice>
				{/if}

				<TextField
					label="MCP token"
					name="token"
					type="password"
					mono
					placeholder="ari_mcp_…"
					autocomplete="off"
					spellcheck="false"
				/>

				{#each hiddenParams as key (key)}
					<input type="hidden" name={key} value={params?.[key] ?? ''} />
				{/each}

				<Button variant="primary" size="lg" block type="submit" iconAfter="arrowR">
					Authorize
				</Button>
			</form>
		</Card>
	</div>
</main>

<style>
	.authorize {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-7);
	}
	.panel {
		width: 100%;
		max-width: 420px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h1 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
	}
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.host {
		font-family: var(--font-mono);
		color: var(--text-1);
		word-break: break-all;
	}
</style>
