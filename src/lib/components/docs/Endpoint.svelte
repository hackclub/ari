<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	interface Props {
		method: 'POST' | 'GET';
		baseUrl: string;
		programId: string;
		suffix?: string;
	}
	let { method, baseUrl, programId, suffix = '' }: Props = $props();
</script>

<div class="endpoint">
	<span class={['method', method === 'GET' ? 'get' : 'post']}>{method}</span>
	<span class="url">{baseUrl}/api/ingest/<span class="token">{programId}</span>{suffix}</span>
	<CopyButton text={`${baseUrl}/api/ingest/${programId}${suffix}`} />
</div>

<style>
	.endpoint {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
		border: 1px solid var(--doc-line);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--surface) 60%, transparent);
	}
	.method {
		flex: 0 0 auto;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.post {
		color: var(--color-green);
		background: color-mix(in srgb, var(--color-green) 16%, transparent);
	}
	.get {
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 16%, transparent);
	}
	.url {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text);
	}
	.token {
		color: var(--primary);
	}
</style>
