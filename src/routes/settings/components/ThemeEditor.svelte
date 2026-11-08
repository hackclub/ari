<script lang="ts">
	import { ColorPicker, SegmentedControl, Select } from '$lib/components/ui';
	import { theme } from '$lib/theme.svelte';
	import {
		customAccentPresets,
		familySupportsLight,
		themeFamilies,
		type ThemeFamily
	} from '$lib/themes';

	const familyOptions = themeFamilies.map((entry) => ({ value: entry.id, label: entry.label }));
	const activeDescription = $derived(
		themeFamilies.find((entry) => entry.id === theme.family)?.description ?? ''
	);
	const lightSupported = $derived(familySupportsLight(theme.family));
	const modeValue = $derived(theme.dark ? 'dark' : 'light');

	let accentDraft = $state(theme.customAccent);

	// saves straight from the gesture: no derived push, so a store write
	// can never circle back into this component
	function pickAccent(next: string) {
		accentDraft = next;
		theme.setCustomAccent(next);
	}
</script>

<div class="row">
	<div>
		<h2>Theme</h2>
		<p>Presets plus your own accent color. Applies instantly, in this browser only.</p>
	</div>
</div>

<div class="editor">
	<div class="themePicker">
		<Select
			label="Theme"
			name="themeFamily"
			options={familyOptions}
			hint={activeDescription}
			value={theme.family}
			onchange={(event) => theme.setFamily(event.currentTarget.value as ThemeFamily)}
		/>
	</div>
	<div class="modeRow">
		<span class="modeLabel">Mode</span>
		<SegmentedControl
			label="Mode"
			name="themeMode"
			value={modeValue}
			onchange={(picked) => theme.setDark(picked === 'dark')}
			options={[
				{ value: 'light', label: 'Light', icon: 'sun', disabled: !lightSupported },
				{ value: 'dark', label: 'Dark', icon: 'moon' }
			]}
		/>
	</div>
	{#if !lightSupported}
		<p class="note">Dracula is dark-only.</p>
	{/if}
	{#if theme.family === 'custom'}
		<div
			class="pickerWrap"
			onchange={(event) => {
				const picked = event.target;
				if (picked instanceof HTMLInputElement) pickAccent(picked.value);
			}}
		>
			<ColorPicker
				label="Accent color"
				name="customAccent"
				colors={customAccentPresets}
				bind:value={accentDraft}
			/>
		</div>
		<label class="customPick">
			<span>Or pick any color <code>{accentDraft}</code></span>
			<input
				type="color"
				name="customAccentPicker"
				bind:value={accentDraft}
				oninput={(event) => pickAccent(event.currentTarget.value)}
			/>
		</label>
	{/if}
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
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
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.themePicker {
		max-width: 320px;
	}
	.modeRow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.modeLabel {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.note {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.customPick {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}
	.customPick code {
		font-family: var(--font-mono);
		font-weight: 400;
		color: var(--text-2);
	}
	input[type='color'] {
		width: var(--control-md);
		height: var(--control-md);
		padding: 0;
		border: 1px solid var(--border-2);
		border-radius: var(--radius-full);
		background: var(--surface);
		cursor: pointer;
	}
</style>
