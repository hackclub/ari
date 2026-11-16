<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/app/Logo.svelte';
	import { Button, Card, EmptyState } from '$lib/components/ui';

	const status = $derived(page.status);

	const knownCopy: Record<number, { title: string; body: string }> = {
		403: {
			title: 'Access denied',
			body: "You don't have permission to view this. Ask an organizer if you think this is a mistake."
		},
		404: { title: 'Page not found', body: "This page doesn't exist, or it may have moved." },
		500: {
			title: 'Something went wrong',
			body: 'Something broke on our end. Try again in a moment.'
		}
	};
	const copy = $derived(
		knownCopy[status] ??
			(status >= 500
				? { title: 'Something went wrong', body: 'Something broke on our end.' }
				: { title: "Something's not right", body: "We couldn't load this page." })
	);

	// the thrown message is shown only when it adds detail beyond the framework defaults
	const genericMessages = [
		'Not Found',
		'Internal Error',
		'Forbidden',
		'Bad Request',
		'Service Unavailable'
	];
	const detail = $derived(
		page.error?.message &&
			!genericMessages.includes(page.error.message) &&
			page.error.message !== copy.title
			? page.error.message
			: null
	);
</script>

<svelte:head><title>{status} · {copy.title} · Ari</title></svelte:head>

<main class="errorPage">
	<Logo linked />
	<Card>
		<p class="path">{page.url.pathname}</p>
		<h1 class="status">{status}</h1>
		<EmptyState
			title={copy.title}
			icon={status === 403 ? 'lock' : status === 404 ? 'search' : 'info'}
		>
			{copy.body}
			{#snippet actions()}
				<Button icon="arrowL" onclick={() => history.back()}>Go back</Button>
				<Button variant="primary" href="/programs" iconAfter="arrowR">Back to programs</Button>
			{/snippet}
		</EmptyState>
		{#if detail}<p class="detail">{detail}</p>{/if}
	</Card>
	<p class="foot">If this keeps happening, contact your program organizer.</p>
</main>

<style>
	.errorPage {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--space-4);
		max-width: 560px;
		min-height: 100vh;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
	.path {
		margin: 0;
		overflow: hidden;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status {
		margin: var(--space-4) 0 0;
		font-family: var(--font-mono);
		font-size: clamp(3.5rem, 15vw, 5.25rem);
		font-weight: 600;
		line-height: 1;
		text-align: center;
		color: var(--primary);
		user-select: none;
	}
	.detail {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--primary);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		background: var(--surface-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.5;
		color: var(--text-2);
		overflow-wrap: anywhere;
	}
	.foot {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-3);
	}
</style>
