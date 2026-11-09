<script lang="ts">
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Avatar, Badge, Icon, Meter } from '$lib/components/ui';
	import { permissionLabel } from '$lib/data';
	import { accessLabel, type RosterRow } from '../rosterTypes';

	interface Props {
		row: RosterRow;
		columnKey: string;
		goal: number;
		flash?: boolean;
	}
	let { row, columnKey, goal, flash = false }: Props = $props();

	const percent = $derived(goal > 0 ? (row.week / goal) * 100 : 0);
	const online = $derived(row.lastSeen === 'now');
</script>

{#if columnKey === 'person'}
	<div class={['person', flash && 'flash']} data-reviewer-email={row.email}>
		<Avatar name={row.name} color={row.color} slackId={row.slackId} decorative />
		<div class="identity">
			<span class="name">
				<span class="truncate">{row.name}</span>
				{#if row.isPoc}
					<Badge tone="secondpass"><Icon name="shield" size={11} /> POC</Badge>
				{/if}
				{#if row.pending}<Badge tone="pending">Pending</Badge>{/if}
			</span>
			<span class="email truncate">{row.email}</span>
		</div>
	</div>
{:else if columnKey === 'access'}
	<div class="access">
		<span class="tracks">
			{#if row.isPoc}
				<span class="muted">All tracks</span>
			{:else}
				{#each row.tracks as track (track)}<TrackPill {track} />{/each}
			{/if}
		</span>
		<span
			class="muted"
			title={row.isPoc ? undefined : row.permissions.map(permissionLabel).join(', ') || undefined}
		>
			{accessLabel(row)}
		</span>
	</div>
{:else if columnKey === 'week'}
	{#if row.pending}
		<span class="muted">Awaiting first sign-in</span>
	{:else}
		<div class="week">
			<Meter
				label="{row.total} all-time"
				value={row.week}
				max={Math.max(goal, 1)}
				valueText="{row.week} / {goal}"
				layout="inline"
				tone={percent >= 100 ? 'ok' : percent < 40 ? 'warn' : 'primary'}
			/>
		</div>
	{/if}
{:else if columnKey === 'approval'}
	<span class="number">{row.pending ? '-' : `${row.approvalPercent}%`}</span>
{:else if columnKey === 'lastSeen'}
	<span class={['muted', online && 'online']}>
		{online ? 'Active now' : row.pending ? row.lastSeen : `${row.lastSeen} ago`}
	</span>
{/if}

<style>
	.person {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		border-radius: var(--radius-md);
	}
	.flash {
		animation: flash 1.6s ease-out;
	}
	@keyframes flash {
		from {
			background: var(--primary-soft);
			box-shadow: 0 0 0 var(--space-2) var(--primary-soft);
		}
		to {
			background: transparent;
			box-shadow: 0 0 0 var(--space-2) transparent;
		}
	}
	.identity {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.email {
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.access {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.tracks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.muted {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.online {
		font-weight: 600;
		color: var(--color-green);
	}
	.week {
		width: 100%;
		min-width: 0;
	}
	.number {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		.flash {
			animation: none;
		}
	}
</style>
