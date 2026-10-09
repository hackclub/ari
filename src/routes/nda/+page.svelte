<script lang="ts">
	import { submitAction } from '$lib/actions';
	import { Button, Dialog, Notice } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let checking = $state(false);
	let errorMessage = $state<string | null>(null);

	async function recheck() {
		if (checking) return;
		checking = true;
		errorMessage = null;
		const result = await submitAction('recheck', {}, { actionUrl: '/nda' });
		// a clear result redirects to /programs from inside submitAction
		if (result.ok) return;
		errorMessage = result.message;
		checking = false;
	}
</script>

<svelte:head><title>NDA · Ari</title></svelte:head>

<main class="ndaPage">
	<img src="/flag.png" alt="Hack Club" class="cornerFlag" />
</main>

<Dialog
	open={true}
	title="Sign the Hack Club NDA to continue"
	description="Everyone who reviews on Ari has to sign the current Hack Club NDA first."
	icon="shield"
	size="sm"
	dismissible={false}
>
	<div class="body">
		{#if data.status === 'noSlack'}
			<p>
				We couldn't find a Slack account on your profile, so we can't check your signature. Link
				Slack in Hack Club Auth, then sign out and back in.
			</p>
		{:else if data.status === 'unknown'}
			<p>We couldn't reach the NDA service just now. Sign if you haven't yet, then try again.</p>
		{:else}
			<p>
				Sign the NDA on the Hack Club NDA site, then come back here and press
				<strong>I've signed it</strong>.
			</p>
		{/if}
		{#if errorMessage}
			<Notice tone="danger">{errorMessage}</Notice>
		{/if}
	</div>
	{#snippet footer()}
		<form method="post" action="/auth/logout" class="signOut">
			<Button variant="quiet" type="submit" icon="logout">Sign out</Button>
		</form>
		{#if data.signUrl}
			<Button
				variant="soft"
				href={data.signUrl}
				target="_blank"
				rel="noopener"
				iconAfter="external"
				data-autofocus
			>
				Sign the NDA
			</Button>
		{/if}
		<Button variant="primary" icon="refresh" loading={checking} onclick={recheck}>
			I've signed it
		</Button>
	{/snippet}
</Dialog>

<style>
	.signOut {
		display: contents;
	}
	.ndaPage {
		position: relative;
		min-height: 100vh;
	}
	.cornerFlag {
		position: absolute;
		top: var(--space-5);
		left: var(--space-5);
		height: 36px;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.body p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
</style>
