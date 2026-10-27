<script lang="ts">
	import { Button, Dropdown, Swatch, type DropdownItem } from '$lib/components/ui';

	interface AssignedProgram {
		id: string;
		name: string;
		color: string;
		iconUrl: string | null;
		pending: number;
	}
	interface Props {
		programId: string;
		program: string;
		color: string;
		iconUrl: string | null;
		assigned: AssignedProgram[];
		orgWide: boolean;
	}
	let { programId, program, color, iconUrl, assigned, orgWide }: Props = $props();

	const items = $derived<DropdownItem[]>([
		...assigned.map((entry) => ({
			label: entry.name,
			href: `/p/${entry.id}`,
			selected: entry.id === programId,
			color: entry.color,
			imageUrl: entry.iconUrl ?? undefined,
			detail: entry.id === programId ? undefined : String(entry.pending)
		})),
		// org-wide viewers reach every program, but only their own are listed here
		...(orgWide
			? [
					{
						label: 'Browse all programs',
						icon: 'layers' as const,
						href: '/programs?all=1',
						separatorBefore: true
					}
				]
			: [])
	]);
</script>

<Dropdown {items}>
	{#snippet trigger(triggerProps)}
		<Button iconAfter="chevD" title={program} aria-label="Program: {program}" {...triggerProps}>
			<Swatch {color} src={iconUrl} size="sm" />
			<span class="name">{program}</span>
		</Button>
	{/snippet}
	{#snippet header()}
		<div class="heading">Your programs</div>
	{/snippet}
</Dropdown>

<style>
	.name {
		overflow: hidden;
		max-width: 180px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.heading {
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--text-3);
	}
	@media (max-width: 600px) {
		.name {
			max-width: 84px;
		}
	}
</style>
