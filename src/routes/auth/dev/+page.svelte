<script lang="ts">
	import { Badge, Button, Card, EmptyState } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Membership = PageData['users'][number]['memberships'][number];

	const membershipLabel = (membership: Membership) =>
		[
			membership.program.name,
			membership.isPoc ? 'POC' : '',
			membership.tracks.join(' + '),
			membership.permissions.length
				? `${membership.permissions.length} permission${membership.permissions.length === 1 ? '' : 's'}`
				: ''
		]
			.filter(Boolean)
			.join(' · ');
</script>

<svelte:head><title>Development sign-in · Ari</title></svelte:head>

<main class="devLogin">
	<h1>Development sign-in</h1>
	<p class="intro">Pick a seeded user. This page only exists under <code>bun run dev</code>.</p>

	{#if data.users.length === 0}
		<Card>
			<EmptyState title="No users yet" icon="user">
				Run <code>bun run db:seed</code> to create sample programs, reviewers and ships.
			</EmptyState>
		</Card>
	{:else}
		<ul class="userList">
			{#each data.users as user (user.id)}
				<li>
					<Card variant="flat">
						<form method="POST" class="userRow">
							<input type="hidden" name="userId" value={user.id} />
							<div class="who">
								<strong>{user.name}</strong>
								<span class="email">{user.email}</span>
								<div class="roles">
									{#if user.orgPermissions.length}<Badge tone="secondpass">Org admin</Badge>{/if}
									{#each user.memberships as membership (membership.program.name)}
										<Badge>{membershipLabel(membership)}</Badge>
									{/each}
								</div>
							</div>
							<Button type="submit" variant="primary" iconAfter="arrowR">Sign in</Button>
						</form>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.devLogin {
		max-width: 620px;
		margin: 0 auto;
		padding: var(--space-7) var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 600;
	}
	.intro {
		margin: var(--space-2) 0 var(--space-5);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.userList {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.userRow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.email {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.roles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
