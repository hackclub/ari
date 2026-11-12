<script lang="ts">
	import { Checkbox, Select, TextField } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context, draft, validation } = useReview();
	const locked = $derived(!draft.editable);

	const text = (key: string): string => {
		const stored = draft.value.fieldValues[key];
		return typeof stored === 'string' ? stored : '';
	};
	const picked = (key: string): string[] => {
		const stored = draft.value.fieldValues[key];
		return Array.isArray(stored) ? stored : [];
	};
	function togglePick(key: string, option: string, chosen: boolean) {
		const others = picked(key).filter((entry) => entry !== option);
		draft.setField(key, chosen ? [...others, option] : others);
	}
</script>

{#snippet required()}
	<span class="required" title="Required before approving" aria-label="required">*</span>
{/snippet}

<section class="fields" data-review-region="customFields">
	<h2>Details</h2>
	{#each context.data.customFields as field (field.id)}
		{@const error = validation.errorFor(`field:${field.key}`)}
		<div
			class={{ field: true, invalid: error !== null }}
			data-review-field="field:{field.key}"
			data-field-type={field.type}
		>
			{#if field.type === 'checkbox'}
				<Checkbox
					checked={draft.value.fieldValues[field.key] === true}
					disabled={locked}
					onchange={(event) => draft.setField(field.key, event.currentTarget.checked)}
				>
					<span class="name"
						>{field.label}{#if field.required}{@render required()}{/if}</span
					>
				</Checkbox>
				{#if field.description}<p class="hint">{field.description}</p>{/if}
				{#if error}<p class="error">{error}</p>{/if}
			{:else if field.type === 'select'}
				<Select
					label={field.label}
					name="field-{field.key}"
					required={field.required}
					disabled={locked}
					hint={field.description ?? undefined}
					{error}
					options={[
						{ value: '', label: locked ? '—' : 'Select…' },
						...field.options.map((option) => ({ value: option, label: option }))
					]}
					value={text(field.key)}
					onchange={(event) => draft.setField(field.key, event.currentTarget.value)}
				/>
			{:else if field.type === 'multiselect'}
				<fieldset disabled={locked}>
					<legend>
						<span class="name"
							>{field.label}{#if field.required}{@render required()}{/if}</span
						>
					</legend>
					{#if field.description}<p class="hint">{field.description}</p>{/if}
					{#each field.options as option (option)}
						<Checkbox
							checked={picked(field.key).includes(option)}
							disabled={locked}
							onchange={(event) => togglePick(field.key, option, event.currentTarget.checked)}
						>
							{option}
						</Checkbox>
					{/each}
				</fieldset>
				{#if error}<p class="error">{error}</p>{/if}
			{:else}
				<TextField
					label={field.label}
					name="field-{field.key}"
					type={field.type === 'number' ? 'number' : 'text'}
					required={field.required}
					readonly={locked}
					hint={field.description ?? undefined}
					{error}
					value={text(field.key)}
					oninput={(event) => draft.setField(field.key, event.currentTarget.value)}
				/>
			{/if}
		</div>
	{/each}
</section>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	h2 {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		border-radius: var(--radius-sm);
	}
	.invalid:not(:has(:global(.field))) {
		outline: 2px solid color-mix(in srgb, var(--color-red) 65%, transparent);
		outline-offset: var(--space-1);
	}
	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		font-size: var(--text-sm);
	}
	.name {
		font-weight: 600;
	}
	.required {
		margin-left: var(--space-1);
		color: var(--color-red);
	}
	p {
		margin: 0;
		font-size: var(--text-xs);
	}
	.hint {
		color: var(--text-2);
	}
	.error {
		color: var(--color-red);
	}
</style>
