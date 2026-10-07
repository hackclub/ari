<script lang="ts">
	import './docs.css';
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Icon } from '$lib/components/ui';

	let { children }: { children: Snippet } = $props();

	const webhookPath = resolve('/docs/webhooks');
	const mcpPath = resolve('/docs/mcp');
	const groups = [
		{
			label: 'Inbound webhooks',
			path: webhookPath,
			items: [
				{ id: 'endpoint', label: 'Endpoint' },
				{ id: 'authentication', label: 'Signing requests' },
				{ id: 'sending', label: 'Sending a ship' },
				{ id: 'updates', label: 'Correcting a ship' },
				{ id: 'fields', label: 'Payload fields' },
				{ id: 'collaborative', label: 'Collaborative ships' },
				{ id: 'withdraw', label: 'Withdrawing a ship' },
				{ id: 'status', label: 'Checking ship status' },
				{ id: 'responses', label: 'Response codes' }
			]
		},
		{
			label: 'Outbound webhooks',
			path: webhookPath,
			items: [
				{ id: 'how-it-works', label: 'How delivery works' },
				{ id: 'events', label: 'Events' },
				{ id: 'payload', label: 'Payload' },
				{ id: 'time', label: 'Time fields' },
				{ id: 'fraud', label: 'Fraud review' }
			]
		},
		{
			label: 'MCP and program setup',
			path: mcpPath,
			items: [
				{ id: 'overview', label: 'Overview' },
				{ id: 'connecting', label: 'Tokens and connecting' },
				{ id: 'access', label: 'What a token can reach' },
				{ id: 'rest', label: 'REST and OpenAPI' },
				{ id: 'create', label: 'Creating a program' },
				{ id: 'settings', label: 'Changing settings' },
				{ id: 'review-tools', label: 'Checklist and fields' },
				{ id: 'branding', label: 'Icon and card background' },
				{ id: 'webhooks-setup', label: 'Ingest and outbound' },
				{ id: 'flags', label: 'Flags and fraud review' },
				{ id: 'tools', label: 'Tool reference' },
				{ id: 'errors', label: 'Errors' }
			]
		}
	];
	const firstSection = (pathname: string) =>
		groups.find((group) => group.path === pathname)?.items[0].id ?? '';

	let activeId = $state(page.url.hash.slice(1) || firstSection(page.url.pathname));
	let mainElement = $state<HTMLElement>();
	const isActive = (path: string, id: string) => page.url.pathname === path && activeId === id;

	// the layout outlives a move between doc pages, so the sections are observed again on each one
	$effect(() => {
		activeId = page.url.hash.slice(1) || firstSection(page.url.pathname);
		const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-doc-section]'));
		if (!mainElement || !sections.length || typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
				if (visible[0]) activeId = visible[0].target.id;
			},
			{ root: mainElement, rootMargin: '0px 0px -68% 0px', threshold: 0 }
		);

		sections.forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	});
</script>

<svelte:head><title>Docs · Ari</title></svelte:head>

<div class="docShell">
	<nav aria-label="Documentation">
		<a class="back" href={resolve('/programs')}><Icon name="arrowL" size={15} /> Back to app</a>
		{#each groups as group (group.label)}
			<div class="group">
				<div class="groupLabel">{group.label}</div>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- each route is resolved before its section fragment is appended -->
				{#each group.items as item (item.id)}
					<a
						class={['link', isActive(group.path, item.id) && 'on']}
						href={`${group.path}#${item.id}`}
						onclick={() => (activeId = item.id)}>{item.label}</a
					>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/each}
	</nav>

	<main bind:this={mainElement}>
		{@render children()}
	</main>
</div>

<style>
	.docShell {
		display: flex;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
	}
	nav {
		flex: 0 0 var(--doc-nav-width);
		padding: var(--space-5) var(--space-3) var(--space-5) var(--space-5);
		border-right: 1px solid var(--doc-line);
		overflow: auto;
	}
	main {
		flex: 1;
		min-width: 0;
		overflow: auto;
	}
	.back,
	.link {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
		text-decoration: none;
		transition:
			color 0.14s,
			background 0.14s;
	}
	.back {
		margin-bottom: var(--space-5);
	}
	.back:hover,
	.link:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--surface-3) 55%, transparent);
	}
	.group + .group {
		margin-top: var(--space-5);
	}
	.groupLabel {
		padding: 0 var(--space-3) var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--text-3);
	}
	.link {
		position: relative;
	}
	.link.on {
		color: var(--text);
		background: color-mix(in srgb, var(--primary) 9%, transparent);
	}
	.link.on::before {
		content: '';
		position: absolute;
		left: calc(var(--space-5) * -1);
		top: var(--space-2);
		bottom: var(--space-2);
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--primary);
	}
	@media (max-width: 720px) {
		nav {
			display: none;
		}
	}
</style>
