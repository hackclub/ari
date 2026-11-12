<script lang="ts">
	import { AvatarStack, Icon } from '$lib/components/ui';
	import type { CommitRow } from '$lib/review/reviewTypes';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import SecondsEditor from './SecondsEditor.svelte';

	interface Props {
		commit: CommitRow;
		index: number;
		inRun?: boolean;
	}
	let { commit, index, inRun = false }: Props = $props();

	const { context, cursor, settlement } = useReview();

	const current = $derived(cursor.isCurrent('commits', index));
	const href = $derived(context.repoUrl ? `${context.repoUrl}/commit/${commit.hash}` : null);
	const matched = $derived(
		commit.people
			.filter((person) => person.matched)
			.map((person) => ({ name: person.label, slackId: person.slackId }))
	);
	// on a shared ship, whose time this commit counts towards, unless the authors already say so
	const owner = $derived.by(() => {
		const name = context.data.collaborators?.find(
			(person) => person.makerId === commit.makerId
		)?.name;
		return name && !commit.people.some((person) => person.label === name) ? name : null;
	});
	const separator = (position: number) =>
		position === 0 ? '' : position === commit.people.length - 1 ? ' & ' : ', ';
</script>

<div
	id={cursor.rowId('commits', index)}
	class={{ commitRow: true, current, inRun }}
	aria-current={current ? 'true' : undefined}
	onfocusin={() => cursor.select('commits', index)}
>
	<span class="rail" aria-hidden="true"><span class="node"></span></span>
	{#if href}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the commit on the repository host -->
		<a
			class="message"
			{href}
			target="_blank"
			rel="noreferrer noopener"
			title="Open commit {commit.hash}"
			onclick={() => cursor.select('commits', index)}>{commit.message}</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		<span class="message">{commit.message}</span>
	{/if}
	<div class="details">
		<span class="hash">{commit.hash.slice(0, 7)}</span>
		<span class="when">{commit.when}</span>
		<span class="people">
			{#if matched.length}<AvatarStack people={matched} size="sm" />{/if}
			<span class="names">
				{#each commit.people as person, position (person.label)}{separator(position)}<span
						title={person.matched ? person.label : 'Git author'}>{person.label}</span
					>{/each}
			</span>
		</span>
		{#if owner}
			<span class="owner" title="This commit's coding time counts towards {owner}">
				<Icon name="user" size={11} />{owner}
			</span>
		{/if}
		<!-- hosts read through a blobless clone report no line counts: 0 and 0 means unknown -->
		{#if commit.additions > 0 || commit.deletions > 0}
			<span class="changes">
				<span class="added">+{commit.additions}</span>
				<span class="removed">−{commit.deletions}</span>
			</span>
		{/if}
		{#if commit.codingSeconds > 0}
			<span
				class="coding"
				title={settlement.commitAnchored
					? settlement.commitsEditable
						? 'Coding time attributed to this commit. The tracked time was lost in the capture, so this is what gets credited'
						: 'Coding time attributed to this commit. This review was decided when commits anchored the credited time'
					: 'Coding time attributed to this commit. View data: the credited time comes from the tracked rows, so the two can disagree without anything being lost'}
			>
				<Icon name="clock" size={11} />
				{#if settlement.commitAnchored}
					<SecondsEditor
						kind="commits"
						rowId={commit.id}
						capturedSeconds={commit.codingSeconds}
						label="commit {commit.hash.slice(0, 7)}"
						editable={settlement.commitsEditable}
					/>
				{:else}
					{formatDuration(commit.codingSeconds)}
				{/if}
			</span>
		{/if}
	</div>
</div>

<style>
	.commitRow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: 0 calc(-1 * var(--space-2));
		padding: var(--space-2);
		border-radius: var(--radius-md);
		transition: background 0.12s;
	}
	.commitRow:hover,
	.commitRow.current {
		background: var(--surface-2);
	}
	.commitRow.current {
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
		border: 2.5px solid var(--primary);
		border-radius: 50%;
		background: var(--surface);
	}
	.inRun .node {
		width: 9px;
		height: 9px;
		border-color: var(--border-2);
	}
	.message {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		color: var(--text);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.message:hover {
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
	.hash,
	.changes {
		font-family: var(--font-mono);
	}
	.changes,
	.coding {
		white-space: nowrap;
	}
	.people,
	.owner,
	.coding {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.names {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.owner {
		color: var(--text-2);
		font-weight: 600;
	}
	.added {
		color: var(--color-green);
	}
	.removed {
		color: var(--color-red);
	}
	.coding {
		color: var(--color-blue);
		font-weight: 600;
	}
	@container evidenceTile (max-width: 560px) {
		.commitRow {
			flex-wrap: wrap;
		}
		.message {
			/* 12px rail plus the row gap */
			flex-basis: calc(100% - 12px - var(--space-3));
		}
		.details {
			flex: 1 0 100%;
			flex-wrap: wrap;
			/* lines up under the message, past the 12px rail and the row gap */
			padding-left: calc(12px + var(--space-3));
		}
		.people {
			max-width: 100%;
		}
	}
</style>
