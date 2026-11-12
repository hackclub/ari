<script lang="ts">
	import ShipTimeCell from '$lib/components/app/ships/ShipTimeCell.svelte';
	import { Badge, DataTable, Swatch, type DataTableColumn } from '$lib/components/ui';
	import { formatDuration } from '$lib/time';
	import type { PageData } from '../$types';
	import Section from './Section.svelte';

	interface Props {
		crossProgram: NonNullable<PageData['crossProgram']>;
		subjectId: string;
	}
	let { crossProgram, subjectId }: Props = $props();

	const columns: DataTableColumn[] = [
		{ key: 'name', label: 'Program', width: '2fr', minWidth: '160px' },
		{ key: 'reviews', label: 'Reviews', width: '90px', align: 'end' },
		{ key: 'approvedSeconds', label: 'Time approved', width: '140px', align: 'end' },
		{ key: 'vms', label: 'VMs', width: '70px', align: 'end', hideBelow: 'sm' }
	];
</script>

<Section
	title="Across all programs"
	icon="grid"
	flush
	detail="{crossProgram.totalReviews} reviews · {formatDuration(
		crossProgram.approvedSeconds
	)} approved · {crossProgram.totalVms} VMs"
>
	<DataTable
		flush
		label="Reviews by program"
		density="compact"
		stickyHeader={false}
		{columns}
		rows={crossProgram.programs}
		rowKey={(row) => row.programId}
		rowHref={(row) => `/p/${row.programId}/reviewers/${subjectId}`}
		rowLabel={(row) => `Open this reviewer on ${row.name}`}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'name'}
				<span class="program">
					<Swatch color={row.color} size="sm" />
					<span class="name">{row.name}</span>
					{#if row.current}<Badge>Viewing</Badge>{/if}
				</span>
			{:else if column.key === 'reviews'}
				<span class="number">{row.reviews}</span>
			{:else if column.key === 'approvedSeconds'}
				<ShipTimeCell seconds={row.approvedSeconds} />
			{:else}
				<span class="number">{row.vms}</span>
			{/if}
		{/snippet}
	</DataTable>
</Section>

<style>
	.program {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.number {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
	}
</style>
