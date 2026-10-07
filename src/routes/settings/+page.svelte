<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import { Button, Card, Textarea, ThemeToggle } from '$lib/components/ui';
	import { customCss } from '$lib/customCss.svelte';

	let draft = $state(customCss.text);
	const dirty = $derived(draft !== customCss.text);
</script>

<svelte:head><title>Settings · Ari</title></svelte:head>

<PageHeader title="Settings" description="Your preferences." />

<Card>
	<div class="row">
		<div>
			<h2>Appearance</h2>
			<p>Switch between the light and dark theme.</p>
		</div>
		<ThemeToggle showLabel />
	</div>
</Card>

<Card>
	<div class="row">
		<div>
			<h2>Custom CSS</h2>
			<p>Extra styles applied on top of everything, in this browser only.</p>
		</div>
	</div>
	<div class="cssField">
		<Textarea
			label="Custom CSS"
			name="customCss"
			mono
			rows={8}
			placeholder={':root {\n\t--primary: #7c3aed;\n}'}
			bind:value={draft}
		/>
	</div>
	<div class="actions">
		<Button variant="primary" disabled={!dirty} onclick={() => customCss.save(draft)}>Save</Button>
		{#if customCss.text}
			<Button
				onclick={() => {
					customCss.save('');
					draft = '';
				}}>Clear</Button
			>
		{/if}
	</div>
</Card>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.row + .row {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	h2 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 700;
	}
	p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.cssField {
		margin-top: var(--space-4);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
