<script lang="ts">
	import Note from '$lib/components/docs/Note.svelte';
	import { Select } from '$lib/components/ui';
	import FieldsSections from './sections/FieldsSections.svelte';
	import FraudSection from './sections/FraudSection.svelte';
	import LifecycleSections from './sections/LifecycleSections.svelte';
	import OutboundSections from './sections/OutboundSections.svelte';
	import SendingSections from './sections/SendingSections.svelte';

	let { data } = $props();
	const programs = $derived(data.programs);
	const baseUrl = $derived(data.ingestBaseUrl);

	let selectedId = $state('');
	const programId = $derived(
		programs.find((program) => program.id === selectedId)?.id ?? '{program}'
	);

	$effect(() => {
		if (selectedId || !programs.length) return;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem('ari-docs-program');
		} catch {
			saved = null;
		}
		selectedId = programs.find((program) => program.id === saved)?.id ?? programs[0].id;
	});

	function rememberProgram() {
		try {
			localStorage.setItem('ari-docs-program', selectedId);
		} catch {
			return;
		}
	}
</script>

<svelte:head><title>Webhooks · Docs · Ari</title></svelte:head>

<article>
	<header>
		<div class="eyebrow">Reference</div>
		<h1>Webhooks</h1>
		<p class="lead">
			Ari talks to your program in two directions. You send ships to Ari when makers submit them,
			and Ari sends the result back to you once a reviewer decides. Every request, both ways, is
			signed so each side can trust the other.
		</p>
		<Note>
			{#if programs.length}
				<p>
					The examples below fill in a real program ID. <strong>Pick a program</strong> to switch
					the ID in every endpoint and sample. Each program's signing secrets and delivery logs live
					in
					<code>Settings → Webhooks</code>.
				</p>
				<div class="picker">
					<Select
						label="Your programs"
						name="docsProgram"
						bind:value={selectedId}
						onchange={rememberProgram}
						options={programs.map((program) => ({ value: program.id, label: program.name }))}
					/>
				</div>
			{:else}
				<p>
					Wherever you see <code>{programId}</code> below, use your own program's ID. Your real
					endpoint, signing secrets, and delivery logs all live in that program's
					<code>Settings → Webhooks</code>.
				</p>
			{/if}
		</Note>
	</header>

	<SendingSections {baseUrl} {programId} />
	<FieldsSections />
	<LifecycleSections {baseUrl} {programId} />
	<OutboundSections />
	<FraudSection />
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
		font-weight: 600;
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
	.picker {
		max-width: 320px;
		margin-top: var(--space-3);
	}
	@media (max-width: 720px) {
		article {
			padding: var(--space-6) var(--space-5) calc(var(--space-7) * 2);
		}
	}
</style>
