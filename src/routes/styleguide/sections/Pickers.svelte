<script lang="ts">
	import { Card, DatePicker } from '$lib/components/ui';

	let shippedOn = $state('2026-10-03');
	let deadline = $state('');
	let rangeFrom = $state('2026-09-07');
	let rangeTo = $state('2026-09-18');
</script>

<h2>Pickers</h2>
<Card>
	<div class="grid">
		<div class="stack">
			<DatePicker label="Shipped on" name="shippedOn" bind:value={shippedOn} />
			<p>Value: {shippedOn || 'unset'}</p>
		</div>
		<div class="stack">
			<DatePicker label="Deadline" bind:value={deadline} min="2026-10-01" max="2026-10-20" />
			<p>Limited to 1–20 October 2026. Value: {deadline || 'unset'}</p>
		</div>
		<div class="stack">
			<DatePicker label="Reviewed between" range bind:from={rangeFrom} bind:to={rangeTo} />
			<p>From {rangeFrom || 'unset'} to {rangeTo || 'unset'}</p>
		</div>
		<div class="stack">
			<DatePicker label="Disabled" value="2026-01-15" disabled />
		</div>
	</div>
</Card>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-4);
	}
</style>
