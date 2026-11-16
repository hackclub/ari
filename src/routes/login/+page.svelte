<script lang="ts">
	import { Button } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Sign in · Ari</title></svelte:head>

<main class="login">
	<img src="/flag.png" alt="Hack Club" class="cornerFlag" />

	<div class="panel">
		<h1>Sign in to Ari</h1>

		{#if data.errorMessage}
			<p class="error" role="alert">{data.errorMessage}</p>
		{/if}

		{#if data.oauthConfigured}
			<Button
				variant="primary"
				size="lg"
				block
				href="/auth/login"
				iconAfter="arrowR"
				data-sveltekit-reload
			>
				Continue with Hack Club
			</Button>
		{/if}

		{#if data.devLoginEnabled}
			<Button variant="ghost" size="lg" block href="/auth/dev" icon="code">
				Development sign-in
			</Button>
		{/if}

		{#if !data.oauthConfigured && !data.devLoginEnabled}
			<p class="hint">
				Sign-in is not configured. Set <code>HC_CLIENT_ID</code> and
				<code>HC_CLIENT_SECRET</code>, or <code>DEV_LOGIN=true</code> for local development.
			</p>
		{/if}
	</div>
</main>

<style>
	.login {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-7) var(--space-6);
	}
	.cornerFlag {
		position: absolute;
		top: var(--space-5);
		left: var(--space-5);
		height: 36px;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
		max-width: 360px;
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-2xl);
		font-weight: 600;
	}
	.error {
		margin: 0;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--primary-soft);
		color: var(--primary);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
</style>
