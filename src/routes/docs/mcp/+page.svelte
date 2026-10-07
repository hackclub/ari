<script lang="ts">
	import Note from '$lib/components/docs/Note.svelte';
	import ConnectSections from './sections/ConnectSections.svelte';
	import ProgramSections from './sections/ProgramSections.svelte';
	import ReferenceSections from './sections/ReferenceSections.svelte';
	import SetupSections from './sections/SetupSections.svelte';

	let { data } = $props();
</script>

<svelte:head><title>MCP · Docs · Ari</title></svelte:head>

<article>
	<header>
		<div class="eyebrow">Reference</div>
		<h1>MCP and program setup</h1>
		<p class="lead">
			Set up and run programs from a script or an AI assistant: create a program, configure its
			review flow, add its organizers and connect its webhooks, all with one token.
		</p>
		<Note>
			<p>
				The OpenAPI description of every tool is public at
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an absolute url to a json endpoint, not an app page -->
				<a href={data.openApiUrl} data-sveltekit-reload>{data.openApiUrl}</a>. Import it into
				Postman, an OpenAPI client generator or any tool that reads OpenAPI 3.1.
			</p>
		</Note>
	</header>

	<ConnectSections endpoint={data.endpoint} />
	<ProgramSections ingestBaseUrl={data.ingestBaseUrl} />
	<SetupSections ingestBaseUrl={data.ingestBaseUrl} />
	<ReferenceSections />
</article>

<style>
	article {
		max-width: var(--doc-measure);
		margin: 0 auto;
		padding: var(--space-7) var(--space-7) calc(var(--space-7) * 3);
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--primary);
	}
	h1 {
		margin: var(--space-4) 0 0;
		font-size: calc(var(--text-2xl) * 1.4);
		font-weight: 800;
		letter-spacing: -0.033em;
		line-height: 1.02;
		color: var(--text);
	}
	.lead {
		max-width: 38em;
		margin: var(--space-4) 0 0;
		font-size: var(--text-lg);
		line-height: 1.6;
		color: var(--text-2);
	}
	@media (max-width: 720px) {
		article {
			padding: var(--space-6) var(--space-5) calc(var(--space-7) * 2);
		}
	}
</style>
