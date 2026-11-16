<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { copyText } from '$lib/actions';
	import { Button, Dialog, EmptyState, Icon, Prose } from '$lib/components/ui';
	import { renderMd } from '$lib/md';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import EvidenceBody from './EvidenceBody.svelte';
	import MakerTag from './MakerTag.svelte';
	import SecondsEditor from './SecondsEditor.svelte';

	interface Props {
		onReveal?: () => void;
	}
	let { onReveal }: Props = $props();

	const { context, cursor, keybinds } = useReview();

	const devlogs = $derived(context.data.evidence.devlogs);

	let openId = $state<string | null>(null);
	let dialogOpen = $state(false);
	let entryTop = $state<HTMLElement>();
	const openIndex = $derived(devlogs.findIndex((devlog) => devlog.id === openId));
	const entry = $derived(openIndex >= 0 ? devlogs[openIndex] : null);

	$effect(() => {
		void context.ship.id;
		dialogOpen = false;
	});

	function open(index: number) {
		const devlog = devlogs[index];
		if (!devlog) return;
		cursor.select('devlog', index);
		openId = devlog.id;
		dialogOpen = true;
	}

	function step(delta: number) {
		const next = Math.min(devlogs.length - 1, Math.max(0, openIndex + delta));
		if (next === openIndex) return;
		open(next);
		entryTop?.scrollIntoView({ block: 'start' });
	}

	// 90 pixels: about four lines of the entry per key press
	const scroll = (direction: number) => entryTop?.parentElement?.scrollBy({ top: 90 * direction });

	// ?entry=<id> opens that entry, once per link
	let appliedLink: string | null = null;
	$effect(() => {
		const wanted = page.url.searchParams.get('entry');
		const index = wanted ? devlogs.findIndex((devlog) => devlog.id === wanted) : -1;
		if (index < 0) return;
		const link = `${context.ship.id}:${wanted}`;
		if (link === appliedLink) return;
		appliedLink = link;
		untrack(() => {
			onReveal?.();
			open(index);
			// bringing the tile forward puts the cursor on its first row: move it back to the entry
			void tick().then(() => cursor.select('devlog', index));
		});
	});

	const entryLink = (entryId: string) =>
		`${page.url.origin}/p/${context.programId}/review/${context.ship.id}?tab=devlog&entry=${entryId}`;

	// 100 characters: about one line of a full-width tile
	const preview = (text: string) => (text.length > 100 ? `${text.slice(0, 100)}…` : text);

	$effect(() => cursor.registerRows('devlog', { count: () => devlogs.length, open }));

	const reading = () => dialogOpen && entry !== null;
	$effect(() =>
		keybinds.registerShortcuts('evidence', [
			{
				id: 'devlogEntryPrevious',
				label: 'Open devlog entry: previous',
				defaultBinding: 'ArrowLeft',
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => step(-1)
			},
			{
				id: 'devlogEntryNext',
				label: 'Open devlog entry: next',
				defaultBinding: 'ArrowRight',
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => step(1)
			},
			{
				id: 'devlogEntryDown',
				label: 'Open devlog entry: scroll down',
				defaultBinding: 'ArrowDown',
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => scroll(1)
			},
			{
				id: 'devlogEntryUp',
				label: 'Open devlog entry: scroll up',
				defaultBinding: 'ArrowUp',
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => scroll(-1)
			}
		])
	);
</script>

<EvidenceBody>
	{#if devlogs.length === 0}
		<EmptyState title="No devlog entries" icon="book">
			No devlog entries were captured when this ship was registered.
		</EmptyState>
	{:else}
		<div class="devlogs">
			{#each devlogs as devlog, index (devlog.id)}
				{@const current = cursor.isCurrent('devlog', index)}
				<div
					id={cursor.rowId('devlog', index)}
					class={{ devlogRow: true, current }}
					aria-current={current ? 'true' : undefined}
					onfocusin={() => cursor.select('devlog', index)}
				>
					<button type="button" class="open" onclick={() => open(index)}>
						{preview(devlog.text)}
					</button>
					<div class="details">
						{#if devlog.hasImage}
							<span class="image" title="Has an attached image">
								<Icon name="image" size={13} /><span class="hidden">Has an attached image</span>
							</span>
						{/if}
						{#if devlog.makerName}<MakerTag makerId={devlog.makerId} name={devlog.makerName} />{/if}
						<span class="time">
							<Icon name="clock" size={12} />
							<SecondsEditor
								kind="devlogs"
								rowId={devlog.id}
								capturedSeconds={devlog.seconds}
								label="devlog entry {index + 1}"
							/>
						</span>
						<span class="when">{devlog.when}</span>
						{#if current}<kbd>↵</kbd>{:else}<span class="arrow"
								><Icon name="arrowR" size={13} /></span
							>{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</EvidenceBody>

<Dialog
	bind:open={dialogOpen}
	size="lg"
	title={entry?.when ?? 'Devlog entry'}
	description={entry ? `${formatDuration(entry.seconds)} logged` : undefined}
	icon="book"
>
	{#if entry}
		<div class="entry" bind:this={entryTop}>
			{#if entry.makerName}<MakerTag makerId={entry.makerId} name={entry.makerName} />{/if}
			<Prose html={renderMd(entry.markdown)} />
		</div>
	{/if}
	{#snippet footer()}
		{#if entry}
			<span class="position">{openIndex + 1} / {devlogs.length}</span>
			<Button
				size="sm"
				icon="arrowL"
				aria-label="Previous entry"
				disabled={openIndex <= 0}
				onclick={() => step(-1)}
			/>
			<Button
				size="sm"
				icon="arrowR"
				aria-label="Next entry"
				disabled={openIndex >= devlogs.length - 1}
				onclick={() => step(1)}
			/>
			<span class="spacer"></span>
			<Button
				size="sm"
				variant="quiet"
				icon="clip"
				onclick={() => copyText(entryLink(entry.id), 'Devlog link copied')}>Copy link</Button
			>
		{/if}
		<Button size="sm" data-autofocus onclick={() => (dialogOpen = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.devlogs {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.devlogRow {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 calc(-1 * var(--space-2));
		padding: var(--space-2);
		border-bottom: 1px solid var(--border);
		transition: background 0.12s;
	}
	.devlogRow:last-child {
		border-bottom: 0;
	}
	.devlogRow:hover,
	.devlogRow.current {
		background: var(--surface-2);
	}
	.devlogRow.current {
		border-radius: var(--radius-md);
		outline: 1px solid var(--text-3);
		outline-offset: -1px;
	}
	.open {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 24px;
		padding: 2px 0;
		overflow: hidden;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.open:hover {
		color: var(--primary);
	}
	.details {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.image,
	.arrow {
		display: inline-flex;
		flex: none;
	}
	.arrow {
		opacity: 0.5;
	}
	.hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.time {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text-2);
	}
	.when {
		white-space: nowrap;
	}
	kbd {
		padding: 1px var(--space-1);
		border: 1px solid var(--border-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.entry {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		min-width: 0;
		scroll-margin-top: var(--space-4);
	}
	.entry :global(.prose) {
		align-self: stretch;
	}
	.position {
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.spacer {
		flex: 1;
	}
	@container evidenceTile (max-width: 560px) {
		.devlogRow {
			flex-wrap: wrap;
		}
		.details {
			flex: 1 0 100%;
			flex-wrap: wrap;
		}
	}
	@media (pointer: coarse) {
		.open {
			min-height: 36px;
		}
	}
</style>
