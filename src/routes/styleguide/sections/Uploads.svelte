<script lang="ts">
	import { Card, ImageUpload } from '$lib/components/ui';

	let iconUrl = $state('');
	let cardUrl = $state('/flag.png');
	let pastedUrl = $state('');
</script>

<h2>Uploads</h2>
<Card>
	<div class="grid">
		<div class="stack">
			<h3>ImageUpload, square, with its own hint</h3>
			<ImageUpload label="icon" hint="Shown beside the program name" bind:value={iconUrl} />
			<p>
				Pick or drop a file to open the cropper. The styleguide has no upload action, so “Use image”
				fails here. Value: {iconUrl || 'unset'}
			</p>
		</div>
		<div class="stack">
			<h3>ImageUpload, wide and filled</h3>
			<ImageUpload label="card background" mode="wide" bind:value={cardUrl} />
			<p>Value: {cardUrl || 'unset'}</p>
		</div>
		<div class="stack">
			<h3>ImageUpload, uploads not configured</h3>
			<ImageUpload label="icon" uploadsEnabled={false} bind:value={pastedUrl} />
			<p>Value: {pastedUrl || 'unset'}</p>
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
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-5);
	}
</style>
