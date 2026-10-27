<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Button,
		Card,
		Dropdown,
		Icon,
		Swatch,
		Tooltip,
		type DropdownItem
	} from '$lib/components/ui';
	import { evidenceIcon, evidenceLabel } from '$lib/data';
	import type { BoardProgram } from './boardTypes';

	interface Props {
		program: BoardProgram;
		canManage: boolean;
		reingesting: boolean;
		onEdit: () => void;
		onReingest: () => void;
		onArchive: () => void;
	}
	let { program, canManage, reingesting, onEdit, onReingest, onArchive }: Props = $props();

	const draft = $derived(program.status === 'DRAFT');
	// oldest wait in days: under 3 is normal, 3 to 6 warns, 7 or more (a week) is overdue
	const waitTone = $derived(
		draft || program.pending === 0 || program.oldestDays < 3
			? ''
			: program.oldestDays >= 7
				? 'danger'
				: 'warn'
	);
	const items = $derived<DropdownItem[]>([
		{ label: 'Configure program', icon: 'settings', onSelect: onEdit },
		{
			label: 'Re-ingest queued ships',
			icon: 'refresh',
			disabled: reingesting,
			onSelect: onReingest
		},
		{
			label: 'Archive program',
			icon: 'checkCircle',
			tone: 'danger',
			separatorBefore: true,
			onSelect: onArchive
		}
	]);
</script>

<Card>
	<article class="programCard">
		<header>
			<Swatch color={program.color} src={program.iconUrl} />
			<div class="titles">
				<a class="name" href={resolve('/p/[program]', { program: program.id })}>{program.name}</a>
				<span class="sub">
					{draft ? 'Draft' : 'Active'} · {program.reviewers}
					{program.reviewers === 1 ? 'member' : 'members'}
				</span>
			</div>
			{#if canManage}
				<div class="raised">
					<Dropdown {items} align="end">
						{#snippet trigger(triggerProps)}
							<Button
								variant="quiet"
								size="sm"
								icon="dots"
								aria-label="Actions for {program.name}"
								{...triggerProps}
							/>
						{/snippet}
					</Dropdown>
				</div>
			{/if}
		</header>
		<dl class="stats">
			<div>
				<dd class={{ busy: !draft && program.pending > 0 }}>{draft ? '—' : program.pending}</dd>
				<dt>in review</dt>
			</div>
			<div>
				<dd>{draft ? '—' : program.week}</dd>
				<dt>this week</dt>
			</div>
			<div>
				<dd class={waitTone}>
					{draft || program.pending === 0 ? '—' : `${program.oldestDays}d`}
				</dd>
				<dt>oldest wait</dt>
			</div>
		</dl>
		<footer class="raised">
			{#each program.accepts as evidence (evidence)}
				<Tooltip text="Accepts {evidenceLabel(evidence).toLowerCase()}">
					<span class="evidence" role="img" aria-label={evidenceLabel(evidence)}>
						<Icon name={evidenceIcon(evidence)} size={14} />
					</span>
				</Tooltip>
			{/each}
			{#if program.needsPoc}
				<Tooltip text="No POC assigned. Set one in Configure program">
					<Badge tone="changes">Needs POC</Badge>
				</Tooltip>
			{:else if program.poc}
				<Tooltip text="POC: {program.poc.name} ({program.poc.email})">
					<Badge><Icon name="shield" size={11} /> {program.poc.name.split(' ')[0]}</Badge>
				</Tooltip>
			{/if}
			<span class="spacer"></span>
			{#if program.allowVms}
				<Tooltip text="Reviewers can launch VMs">
					<Badge><Icon name="play" size={11} /> VMs</Badge>
				</Tooltip>
			{/if}
			{#if program.secondPass}
				<Tooltip text="Approvals wait for an organizer sign-off">
					<Badge tone="secondpass">2nd pass</Badge>
				</Tooltip>
			{/if}
		</footer>
	</article>
</Card>

<style>
	.programCard {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.titles {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-size: var(--text-md);
		font-weight: 700;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* the whole card opens the program; controls sit above the stretched link */
	.name::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.name:hover {
		text-decoration: underline;
	}
	.sub {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.raised {
		position: relative;
		z-index: 1;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	.stats div {
		display: flex;
		flex-direction: column;
	}
	dd {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 800;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	dt {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.busy {
		color: var(--primary);
	}
	.warn {
		color: var(--status-changes);
	}
	.danger {
		color: var(--status-rejected);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--space-5);
	}
	.evidence {
		display: grid;
		place-content: center;
		color: var(--text-2);
	}
	.spacer {
		flex: 1;
	}
</style>
