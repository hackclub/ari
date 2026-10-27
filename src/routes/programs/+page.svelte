<script lang="ts">
	import { resolve } from '$app/paths';
	import { canOpenAdmin } from '$lib/adminNav';
	import Logo from '$lib/components/app/Logo.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import UserMenu from '$lib/components/app/UserMenu.svelte';
	import { Badge, Button, Card, EmptyState, Swatch } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const count = $derived(data.assigned.length);
	const canAdmin = $derived(canOpenAdmin(data.user?.orgPermissions ?? []));
</script>

<svelte:head><title>{data.showAll ? 'All programs' : 'Your programs'} · Ari</title></svelte:head>

<div class="topBar">
	<Logo />
	<UserMenu />
</div>

<main class="programs">
	<PageHeader
		title={data.showAll ? 'All programs' : `Hi ${data.user?.name ?? ''}!`}
		description={data.empty
			? undefined
			: data.showAll
				? `Every active program in the org: ${count} program${count === 1 ? '' : 's'}.`
				: `You're a reviewer on ${count} program${count === 1 ? '' : 's'}.`}
	>
		{#snippet actions()}
			{#if data.canViewAll}
				<Button
					size="sm"
					icon={data.showAll ? 'user' : 'layers'}
					href={data.showAll ? '/programs' : '/programs?all=1'}
				>
					{data.showAll ? 'Your programs' : 'Browse all programs'}
				</Button>
			{/if}
			{#if canAdmin}
				<Button size="sm" icon="settings" href="/admin">Admin</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.empty}
		<Card>
			<EmptyState
				title={data.showAll ? 'No programs yet' : "You're not in any programs"}
				icon="folder"
			>
				{data.showAll
					? 'There are no active programs in the org right now.'
					: "You're signed in, but you're not on any program yet. Ask your organizer to add you."}
			</EmptyState>
		</Card>
	{:else}
		<ul class="programGrid">
			{#each data.assigned as program (program.id)}
				<li>
					<Card backdrop={program.cardBgUrl}>
						<div class="programCard">
							<div class="cardHead">
								<Swatch color={program.color} src={program.iconUrl} />
								<a class="name" href={resolve('/p/[program]', { program: program.id })}
									>{program.name}</a
								>
								{#if program.pending > 0}
									<Badge tone="pending" dot>{program.pending}</Badge>
								{/if}
							</div>
							<p>
								{program.pending > 0 ? `${program.pending} waiting to review` : 'All caught up'}
								{#if !program.member}· not a member{/if}
							</p>
							<div class="cardActions">
								{#if program.firstWaitingId}
									<Button
										variant="primary"
										size="sm"
										icon="play"
										href="/p/{program.id}/review/{program.firstWaitingId}"
									>
										Review
									</Button>
								{:else}
									<Button variant="soft" size="sm" href="/p/{program.id}/queue">View queue</Button>
								{/if}
								<Button size="sm" href="/p/{program.id}">Open</Button>
							</div>
						</div>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.topBar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
	}
	.programs {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-5) var(--space-4) var(--space-7);
	}
	.programGrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.programCard {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.cardHead {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.name {
		flex: 1;
		overflow: hidden;
		font-weight: 700;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name:hover {
		text-decoration: underline;
	}
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.cardActions {
		display: flex;
		gap: var(--space-2);
	}
</style>
