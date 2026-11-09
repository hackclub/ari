<script lang="ts">
	interface Props {
		// only html built by renderMd or renderReadme: both escape their source and vet every url
		html: string;
	}
	let { html }: Props = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- callers pass sanitised renderer output only -->
<div class="prose">{@html html}</div>

<style>
	.prose {
		min-width: 0;
		color: var(--text);
		font-size: var(--text-md);
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.prose :global(:first-child) {
		margin-top: 0;
	}
	.prose :global(:last-child) {
		margin-bottom: 0;
	}
	.prose :global(:is(img, video)) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: var(--space-3) 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	.prose :global(video) {
		background: black;
	}
	.prose :global(:is(h1, h2)) {
		margin: var(--space-1) 0 var(--space-3);
		font-size: var(--text-xl);
		font-weight: 600;
		line-height: 1.25;
	}
	.prose :global(h3) {
		margin: var(--space-4) 0 var(--space-2);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.prose :global(:is(h4, h5, h6)) {
		margin: var(--space-3) 0 var(--space-2);
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-2);
	}
	.prose :global(:is(p, li, td, blockquote)) {
		color: var(--text-2);
	}
	.prose :global(p) {
		margin: 0 0 var(--space-3);
	}
	.prose :global(:is(ul, ol)) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0 0 var(--space-3);
		padding-left: var(--space-5);
	}
	.prose :global(ul) {
		list-style: disc;
	}
	.prose :global(ol) {
		list-style: decimal;
	}
	.prose :global(li > :is(ul, ol)) {
		margin: var(--space-1) 0 0;
	}
	.prose :global(blockquote) {
		margin: 0 0 var(--space-3);
		padding: 2px 0 2px var(--space-3);
		border-left: 3px solid var(--border-2);
	}
	.prose :global(hr) {
		height: 1px;
		margin: var(--space-4) 0;
		border: 0;
		background: var(--border);
	}
	.prose :global(.md-table-wrap) {
		margin: 0 0 var(--space-3);
		overflow-x: auto;
	}
	.prose :global(table) {
		min-width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	.prose :global(:is(th, td)) {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.prose :global(th) {
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
		white-space: nowrap;
	}
	.prose :global(strong) {
		color: var(--text);
		font-weight: 600;
	}
	.prose :global(code) {
		padding: 2px var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.prose :global(pre) {
		margin: 0 0 var(--space-3);
		padding: var(--space-3);
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-3);
	}
	.prose :global(pre code) {
		padding: 0;
		border-radius: 0;
		background: none;
		color: var(--text);
		white-space: pre;
	}
	.prose :global(a) {
		color: var(--primary);
		font-weight: 600;
	}
	.prose :global(.md-task-item) {
		margin-left: calc(-1 * var(--space-4));
		list-style: none;
	}
	.prose :global(.md-task) {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 1.5px solid var(--border-2);
		border-radius: 3px;
		vertical-align: -1px;
	}
	.prose :global(.md-task.on) {
		border-color: var(--color-green);
		background: var(--color-green);
	}
</style>
