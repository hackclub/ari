<script lang="ts">
	import { page } from '$app/state';
	import { canOpenAdmin } from '$lib/adminNav';
	import { Avatar, Button, Dropdown, ThemeToggle, type DropdownItem } from '$lib/components/ui';

	interface Props {
		side?: 'top' | 'bottom';
		align?: 'start' | 'end';
	}
	let { side = 'bottom', align = 'end' }: Props = $props();

	const user = $derived(page.data.user);
	// mirrors requireAnyProgramOperator on /docs
	const canDocs = $derived(
		!!user &&
			(user.orgPermissions.includes('VIEW_ALL_PROGRAMS') ||
				user.orgPermissions.includes('OPERATE_ALL_PROGRAMS') ||
				user.memberships.some(
					(membership) => membership.isPoc || membership.permissions.length > 0
				))
	);
	const canAdmin = $derived(!!user && canOpenAdmin(user.orgPermissions));

	const items = $derived<DropdownItem[]>([
		...(canDocs ? [{ label: 'Docs', icon: 'book' as const, href: '/docs' }] : []),
		...(canAdmin ? [{ label: 'Admin', icon: 'shield' as const, href: '/admin' }] : []),
		{ label: 'Settings', icon: 'settings' as const, href: '/settings' },
		{
			label: 'Sign out',
			icon: 'logout',
			tone: 'danger',
			separatorBefore: true,
			// a full navigation: the endpoint clears the cookie and redirects
			onSelect: () => window.location.assign('/auth/logout')
		}
	]);
</script>

{#if user}
	<Dropdown {items} {side} {align}>
		{#snippet trigger(triggerProps)}
			<Button variant="quiet" aria-label="Account: {user.name}" {...triggerProps}>
				<Avatar
					name={user.name}
					color={user.avatarColor}
					slackId={user.slackId}
					size="sm"
					decorative
				/>
			</Button>
		{/snippet}
		{#snippet header()}
			<div class="identity">
				<Avatar name={user.name} color={user.avatarColor} slackId={user.slackId} decorative />
				<div class="copy">
					<span class="name">{user.name}</span>
					<span class="email">{user.email}</span>
				</div>
				<ThemeToggle size="sm" />
			</div>
		{/snippet}
	</Dropdown>
{/if}

<style>
	.identity {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 280px;
		margin-bottom: var(--space-1);
		padding: var(--space-2) var(--space-2) var(--space-3) var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		line-height: 1.3;
	}
	.name {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.email {
		overflow: hidden;
		font-size: var(--text-xs);
		color: var(--text-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
