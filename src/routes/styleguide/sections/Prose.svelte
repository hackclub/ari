<script lang="ts">
	import { Card, Prose } from '$lib/components/ui';
	import { renderMd } from '$lib/md';

	const source = [
		'# Devlog entry',
		'Rendered markdown from `renderMd`, or README html from the review endpoint.',
		'## What changed',
		'- **Bold**, *emphasis* and `inline code`',
		'- A link: https://hackclub.com',
		'```ts',
		'const creditedSeconds = 5400;',
		'```'
	].join('\n');
</script>

<h2>Prose</h2>
<Card>
	<Prose html={renderMd(source)} />
</Card>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
</style>
