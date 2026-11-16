<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { EmptyState, Icon } from '$lib/components/ui';
	import type { CommitRow as Commit } from '$lib/review/reviewTypes';
	import { afterLastCommitKey } from '$lib/review/settlement';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import CommitRow from './CommitRow.svelte';
	import EvidenceBody from './EvidenceBody.svelte';
	import SecondsEditor from './SecondsEditor.svelte';

	const { context, cursor, settlement } = useReview();

	const commits = $derived(context.data.evidence.commits);
	const afterSeconds = $derived(context.data.hours.afterLastCommitSeconds);
	// time logged after the newest commit only settles on its own when the tracked time was lost
	const showAfter = $derived(settlement.commitAnchored && afterSeconds > 0);
	const offset = $derived(showAfter ? 1 : 0);

	interface Entry {
		commit: Commit;
		index: number;
	}
	type Item = ({ run: null } & Entry) | { run: Entry[]; key: string };

	// three or more commits in a row with no coding time fold into one line, so the commits that
	// did track time stand out
	const items = $derived.by(() => {
		const list: Item[] = [];
		let run: Entry[] = [];
		const flush = () => {
			if (run.length >= 3) list.push({ run, key: run[0].commit.id });
			else for (const entry of run) list.push({ run: null, ...entry });
			run = [];
		};
		commits.forEach((commit, position) => {
			const entry = { commit, index: position + offset };
			if (commit.codingSeconds > 0) {
				flush();
				list.push({ run: null, ...entry });
			} else run.push(entry);
		});
		flush();
		return list;
	});

	const expanded = new SvelteSet<string>();
	$effect(() => {
		void context.ship.id;
		expanded.clear();
	});

	// the keyboard can land on a folded commit: open its run so the row exists
	$effect(() => {
		if (cursor.tile !== 'commits') return;
		const index = cursor.index;
		const folded = items.find((item) => item.run?.some((entry) => entry.index === index));
		if (!folded?.run) return;
		// untracked: folding the run again by hand must not reopen it
		untrack(() => {
			if (expanded.has(folded.key)) return;
			expanded.add(folded.key);
			void tick().then(() => cursor.scrollIntoView());
		});
	});

	function toggle(key: string) {
		if (expanded.has(key)) expanded.delete(key);
		else expanded.add(key);
	}

	function open(index: number) {
		const commit = commits[index - offset];
		if (!commit) return void cursor.currentTimeInput()?.focus();
		if (context.repoUrl)
			window.open(`${context.repoUrl}/commit/${commit.hash}`, '_blank', 'noopener');
	}

	$effect(() => cursor.registerRows('commits', { count: () => commits.length + offset, open }));
</script>

<EvidenceBody>
	{#if showAfter}
		<div
			id={cursor.rowId('commits', 0)}
			class={{ afterRow: true, current: cursor.isCurrent('commits', 0) }}
			aria-current={cursor.isCurrent('commits', 0) ? 'true' : undefined}
			onfocusin={() => cursor.select('commits', 0)}
		>
			<span class="rail" aria-hidden="true"><span class="node"></span></span>
			<div class="afterCopy">
				<span class="afterTitle"
					><Icon name="clock" size={13} /> Time logged after the last commit</span
				>
				<div class="afterMeta">
					<SecondsEditor
						kind="after"
						rowId={afterLastCommitKey}
						capturedSeconds={afterSeconds}
						label="the time after the last commit"
						editable={settlement.commitsEditable}
					/>
					<span class="afterNote">
						recorded after the most recent commit, likely work that was not pushed before shipping
					</span>
				</div>
			</div>
		</div>
	{/if}
	{#if commits.length === 0}
		<EmptyState title="No commits" icon="commit">
			No commits were captured when this ship was registered.
		</EmptyState>
	{:else}
		<div class="commits">
			{#each items as item (item.run ? `run:${item.key}` : item.commit.id)}
				{#if item.run}
					{@const unfolded = expanded.has(item.key)}
					<button
						type="button"
						class={{ fold: true, unfolded }}
						aria-expanded={unfolded}
						onclick={() => toggle(item.key)}
					>
						<span class="rail" aria-hidden="true"><span class="foldDot"></span></span>
						<span class="foldLabel">{item.run.length} commits · no coding time</span>
						<span class="chevron"><Icon name="chevD" size={14} /></span>
					</button>
					{#if unfolded}
						<div class="run">
							{#each item.run as entry (entry.commit.id)}
								<CommitRow commit={entry.commit} index={entry.index} inRun />
							{/each}
						</div>
					{/if}
				{:else}
					<CommitRow commit={item.commit} index={item.index} />
				{/if}
			{/each}
		</div>
	{/if}
</EvidenceBody>

<style>
	.commits {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2px;
	}
	.afterRow,
	.fold {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: 0 calc(-1 * var(--space-2));
		padding: var(--space-2);
		border-radius: var(--radius-md);
	}
	.afterRow {
		align-items: flex-start;
	}
	.afterRow.current {
		background: var(--surface-2);
		outline: 1px solid var(--text-3);
		outline-offset: -1px;
	}
	.rail {
		display: flex;
		flex: 0 0 12px;
		justify-content: center;
	}
	.node {
		width: 11px;
		height: 11px;
		margin-top: 3px;
		border-radius: 50%;
		background: var(--color-orange);
	}
	.afterCopy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.afterTitle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-orange);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.afterMeta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--color-orange);
	}
	.afterNote {
		color: var(--text-3);
		font-size: var(--text-xs);
		line-height: 1.4;
	}
	.fold {
		/* the negative margins widen it past its column */
		width: calc(100% + 2 * var(--space-2));
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s;
	}
	.fold:hover {
		background: var(--surface-2);
	}
	.foldDot {
		width: 11px;
		height: 11px;
		border: 2px dashed var(--border-2);
		border-radius: 50%;
	}
	.foldLabel {
		flex: 1;
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.chevron {
		display: inline-flex;
		flex: none;
		opacity: 0.6;
		transition: transform 0.15s;
	}
	.fold.unfolded .chevron {
		transform: rotate(180deg);
	}
	.run {
		margin-left: 5px;
		padding-left: var(--space-2);
		border-left: 2px solid var(--border-2);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		background: color-mix(in srgb, var(--surface-2) 35%, transparent);
	}
	@container evidenceTile (max-width: 560px) {
		.afterMeta {
			align-items: flex-start;
			flex-wrap: wrap;
		}
	}
</style>
