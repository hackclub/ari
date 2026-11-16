<script lang="ts">
	import { Button, Dropdown, Icon } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context } = useReview();

	const isUrl = (value: string) => /^https?:\/\//i.test(value);
	const looksLikeImage = (value: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(value);
	const imageKey = (key: string) =>
		/cart|screenshot|image|photo|thumbnail|gallery|preview/i.test(key);

	// what the program attached to the ship at ingest: free-form keys, image values shown inline
	const entries = $derived(
		Object.entries(context.ship.meta ?? {}).map(([key, raw]) => {
			const values = (Array.isArray(raw) ? raw : [raw]).map(String).filter((value) => value.trim());
			const pictured = (value: string) => isUrl(value) && (imageKey(key) || looksLikeImage(value));
			return {
				key,
				images: values.filter(pictured),
				rest: values.filter((value) => !pictured(value))
			};
		})
	);

	let broken = $state<string[]>([]);
	$effect(() => {
		void context.ship.id;
		broken = [];
	});
</script>

{#if entries.length}
	<Dropdown align="end">
		{#snippet trigger(triggerProps)}
			<Button size="sm" icon="layers" iconAfter="chevD" title="Ship details" {...triggerProps}>
				<span class="wide">Details</span>
			</Button>
		{/snippet}
		<dl class="details" data-review-region="shipDetails">
			{#each entries as entry (entry.key)}
				<div class="entry">
					<dt>{entry.key}</dt>
					{#if entry.images.length}
						<dd class="images">
							{#each entry.images as url, index (index)}
								{#if !broken.includes(url)}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- an external image the program sent -->
									<a
										href={url}
										target="_blank"
										rel="noreferrer noopener"
										aria-label="Open image {index + 1} full size"
									>
										<img
											src={url}
											alt="{entry.key} {index + 1}"
											loading="lazy"
											referrerpolicy="no-referrer"
											onerror={() => (broken = [...broken, url])}
										/>
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{/if}
							{/each}
						</dd>
					{/if}
					{#each entry.rest as value, index (index)}
						<dd>
							{#if isUrl(value)}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external link the program sent -->
								<a class="link" href={value} target="_blank" rel="noreferrer noopener">
									{value}
									<Icon name="external" size={12} />
								</a>
							{:else}
								{value}
							{/if}
						</dd>
					{/each}
				</div>
			{/each}
		</dl>
	</Dropdown>
{/if}

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(300px, 80vw);
		max-height: min(60vh, 460px);
		margin: 0;
		padding: var(--space-3) var(--space-4);
		overflow-y: auto;
	}
	.entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	dt {
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	dd {
		margin: 0;
		color: var(--text);
		font-size: var(--text-xs);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.images {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: var(--space-2);
	}
	.images a {
		display: block;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}
	.images img {
		display: block;
		width: 100%;
		height: 92px;
		object-fit: cover;
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--primary);
		font-weight: 600;
	}
	@media (max-width: 700px) {
		.wide {
			display: none;
		}
	}
</style>
