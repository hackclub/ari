<script lang="ts" module>
	export interface Suggestion {
		id: string;
		label: string;
		detail?: string;
	}
</script>

<script lang="ts">
	interface Props {
		id: string;
		label: string;
		suggestions: Suggestion[];
		activeIndex?: number;
		hint?: string;
		onPick: (suggestion: Suggestion, index: number) => void;
	}
	let { id, label, suggestions, activeIndex = $bindable(0), hint, onPick }: Props = $props();

	let listElement = $state<HTMLDivElement>();

	$effect(() => {
		listElement?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div class="suggestionMenu">
	<div {id} class="list" role="listbox" aria-label={label} bind:this={listElement}>
		{#each suggestions as suggestion, index (suggestion.id)}
			<div
				id="{id}-{index}"
				class={{ option: true, active: index === activeIndex }}
				role="option"
				tabindex="-1"
				aria-selected={index === activeIndex}
				onpointerdown={(event) => {
					// focus stays in the input the menu belongs to
					event.preventDefault();
					onPick(suggestion, index);
				}}
				onpointerenter={() => (activeIndex = index)}
			>
				<span class="name">{suggestion.label}</span>
				{#if suggestion.detail}<span class="detail">{suggestion.detail}</span>{/if}
			</div>
		{/each}
	</div>
	{#if hint}<p>{hint}</p>{/if}
</div>

<style>
	.suggestionMenu {
		position: absolute;
		right: 0;
		bottom: calc(100% + var(--space-1));
		left: 0;
		z-index: var(--layer-dropdown);
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
	}
	.list {
		/* about six options before it scrolls */
		max-height: 240px;
		overflow-y: auto;
	}
	.option {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		cursor: pointer;
	}
	.active {
		background: var(--surface-3);
	}
	.name {
		flex: none;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--text);
	}
	.detail {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--text-2);
		font-size: var(--text-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	p {
		margin: var(--space-1) 0 0;
		padding: var(--space-1) var(--space-2) 0;
		border-top: 1px solid var(--border);
		color: var(--text-3);
		font-size: var(--text-xs);
	}
</style>
