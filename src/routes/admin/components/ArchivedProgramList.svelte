<script lang="ts">
	import { Button, Card, List, ListRow, Swatch } from '$lib/components/ui';
	import type { BoardProgram } from './boardTypes';

	interface Props {
		programs: BoardProgram[];
		canManage: boolean;
		restoring: string | null;
		onRestore: (program: BoardProgram) => void;
	}
	let { programs, canManage, restoring, onRestore }: Props = $props();

	const metaFor = (program: BoardProgram) =>
		[
			`${program.reviewers} ${program.reviewers === 1 ? 'member' : 'members'}`,
			...(program.pending > 0 ? [`${program.pending} still pending`] : [])
		].join(' · ');
</script>

<section aria-labelledby="archivedHeading">
	<h2 id="archivedHeading">Archived · {programs.length}</h2>
	<Card padded={false}>
		<List flush aria-labelledby="archivedHeading">
			{#each programs as program (program.id)}
				<ListRow title={program.name} meta={metaFor(program)}>
					{#snippet leading()}<Swatch color={program.color} size="sm" />{/snippet}
					{#snippet actions()}
						{#if canManage}
							<Button
								size="sm"
								icon="refresh"
								loading={restoring === program.id}
								onclick={() => onRestore(program)}
							>
								Restore
							</Button>
						{/if}
					{/snippet}
				</ListRow>
			{/each}
		</List>
	</Card>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
	}
</style>
