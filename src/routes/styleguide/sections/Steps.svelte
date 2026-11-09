<script lang="ts">
	import { Button, Card, ColorPicker, StepDots } from '$lib/components/ui';
	import { accentColors } from '$lib/data';

	const steps = [
		{ id: 'basics', label: 'Basics' },
		{ id: 'evidence', label: 'Evidence' },
		{ id: 'people', label: 'People' }
	];
	let current = $state(1);
	let accent = $state(accentColors[4]);
</script>

<h2>Steps and colours</h2>
<Card>
	<div class="grid">
		<div class="stack">
			<h3>StepDots</h3>
			<div class="row">
				<StepDots {steps} {current} onSelect={(index) => (current = index)} />
				<Button size="sm" disabled={current === steps.length - 1} onclick={() => (current += 1)}>
					Next
				</Button>
			</div>
			<p>On {steps[current].label}. Earlier steps can be revisited, later ones cannot.</p>
		</div>
		<div class="stack">
			<h3>ColorPicker</h3>
			<ColorPicker
				label="Accent colour"
				name="styleguideAccent"
				colors={accentColors}
				bind:value={accent}
			/>
			<p>Value: {accent}</p>
		</div>
	</div>
</Card>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-5);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
