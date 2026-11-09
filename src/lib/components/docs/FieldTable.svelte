<script lang="ts">
	import InlineText from './InlineText.svelte';
	import type { DocField } from './types';

	let { fields }: { fields: DocField[] } = $props();
</script>

<div class="fields">
	{#each fields as field (field.name)}
		<div class="field">
			<div class="head">
				<span class="name">{field.name}</span>
				<span class="type">{field.type}</span>
				{#if field.requirement === 'required'}
					<span class="required">REQUIRED</span>
				{:else if field.requirement === 'oneOf'}
					<span class="required">ONE OF REQUIRED</span>
				{/if}
			</div>
			<div class="description"><InlineText text={field.description} /></div>
		</div>
	{/each}
</div>

<style>
	.fields {
		margin-top: var(--space-4);
		border-top: 1px solid var(--doc-line-soft);
	}
	.field {
		display: grid;
		grid-template-columns: minmax(140px, 220px) 1fr;
		gap: var(--space-2) var(--space-5);
		padding: var(--space-3) 2px;
		border-bottom: 1px solid var(--doc-line-soft);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;
	}
	.name {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text);
		word-break: break-word;
	}
	.type {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.required {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 13%, transparent);
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
	}
	.description {
		font-size: var(--text-sm);
		line-height: 1.6;
		color: var(--text-2);
		align-self: center;
	}
	@media (max-width: 720px) {
		.field {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
	}
</style>
