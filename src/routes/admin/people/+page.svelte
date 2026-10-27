<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import {
		Avatar,
		Badge,
		Button,
		Card,
		ConfirmDialog,
		DataTable,
		Dropdown,
		EmptyState,
		Icon,
		MultiFilter,
		Pagination,
		SearchField,
		Swatch,
		Tooltip,
		type DataTableColumn,
		type DropdownItem
	} from '$lib/components/ui';
	import { submitAction } from '$lib/actions';
	import { orgPermissionLabel } from '$lib/data';
	import { tablePageSize } from '$lib/pagination';
	import { toast } from '$lib/toast.svelte';
	import { intParam, listParam, strParam } from '$lib/urlFilter.svelte';
	import InviteDialog from './components/InviteDialog.svelte';
	import OrgPermissionsDialog from './components/OrgPermissionsDialog.svelte';
	import type { PageData } from './$types';

	type Person = PageData['people'][number];

	let { data }: { data: PageData } = $props();

	const ownEmail = $derived(data.user?.email);
	const programColors = $derived(
		new Map(data.programs.map((program) => [program.name, program.color]))
	);

	const roleFilter = listParam('role');
	const query = strParam<string>('q', '');
	const pageNumber = intParam('page', 1);

	const roleOptions = ['Reviewer', 'Organizer', 'Org'].map((role) => ({
		value: role,
		label: role
	}));

	const filtered = $derived.by(() => {
		const term = query.value.trim().toLowerCase();
		return data.people.filter(
			(person) =>
				(!roleFilter.value.length || roleFilter.value.includes(person.role)) &&
				(!term ||
					person.name.toLowerCase().includes(term) ||
					person.email.toLowerCase().includes(term))
		);
	});
	const lastPage = $derived(Math.max(Math.ceil(filtered.length / tablePageSize()) - 1, 0));
	const currentPage = $derived(Math.min(Math.max((pageNumber.value ?? 1) - 1, 0), lastPage));
	const rows = $derived(
		filtered.slice(currentPage * tablePageSize(), (currentPage + 1) * tablePageSize())
	);

	const columns: DataTableColumn[] = [
		{ key: 'person', label: 'Person', width: '2fr' },
		{ key: 'role', label: 'Org role', width: '130px' },
		{ key: 'programs', label: 'Programs', width: '1.6fr', hideBelow: 'md' },
		{ key: 'last', label: 'Last active', width: '110px', hideBelow: 'sm' }
	];

	let inviteOpen = $state(false);
	let permissionsOpen = $state(false);
	let permissionsFor = $state<Person | null>(null);
	let removeOpen = $state(false);
	let removeTarget = $state<Person | null>(null);
	let slackSyncing = $state(false);

	// own row: nobody removes themselves or edits their own org permissions, and the server refuses too
	function menuFor(person: Person): DropdownItem[] {
		if (person.email === ownEmail) return [];
		const items: DropdownItem[] = [];
		if (!person.pending && data.canGrant)
			items.push({
				label: 'Org permissions',
				icon: 'shield',
				onSelect: () => {
					permissionsFor = person;
					permissionsOpen = true;
				}
			});
		if (data.canManage)
			items.push({
				label: person.pending ? 'Revoke invite' : 'Remove from Ari',
				icon: 'x',
				tone: 'danger',
				onSelect: () => {
					removeTarget = person;
					removeOpen = true;
				}
			});
		return items;
	}

	async function removePerson() {
		if (!removeTarget) return;
		const target = removeTarget;
		const result = await submitAction('remove', { email: target.email });
		if (!result.ok) throw new Error(result.message);
		toast.success(
			target.pending ? `Invite for ${target.email} revoked` : `${target.name} removed from Ari`
		);
	}

	async function syncSlack() {
		slackSyncing = true;
		const result = await submitAction<{ syncing: number }>(
			'syncSlack',
			{},
			{ errorToast: true, invalidate: false, fallbackMessage: 'Could not start the Slack sync' }
		);
		slackSyncing = false;
		if (!result.ok) return;
		const count = result.data?.syncing ?? 0;
		toast.info(`Syncing Slack channels for ${count} ${count === 1 ? 'person' : 'people'}`, {
			icon: 'refresh'
		});
	}
</script>

<svelte:head><title>People · Admin · Ari</title></svelte:head>

<PageHeader title="People" description="Everyone with access to Ari.">
	{#snippet actions()}
		{#if data.canManage}
			<Tooltip text="Re-align the org Slack channels with program membership">
				<Button variant="quiet" icon="refresh" loading={slackSyncing} onclick={syncSlack}>
					Sync Slack
				</Button>
			</Tooltip>
			<Button variant="primary" icon="plus" onclick={() => (inviteOpen = true)}>Add people</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="filters">
	<div class="search">
		<SearchField
			label="Search people"
			placeholder="Search people…"
			bind:value={
				() => query.value,
				(next) => {
					query.value = next;
					pageNumber.value = 1;
				}
			}
		/>
	</div>
	<MultiFilter
		label="Roles"
		options={roleOptions}
		bind:selected={
			() => roleFilter.value,
			(next) => {
				roleFilter.value = next;
				pageNumber.value = 1;
			}
		}
	/>
	<span class="count">{filtered.length} {filtered.length === 1 ? 'person' : 'people'}</span>
</div>

<Card padded={false}>
	<DataTable label="People" {columns} {rows} rowKey={(person) => person.email} flush>
		{#snippet cell({ row, column })}
			{#if column.key === 'person'}
				<Avatar name={row.name} color={row.color} slackId={row.slackId} decorative />
				<div class="person">
					<span class="name">{row.name}</span>
					<span class="email">{row.email}</span>
				</div>
			{:else if column.key === 'role'}
				{#if row.role === 'Org'}
					{#if row.orgPermissions.length}
						<Tooltip text={row.orgPermissions.map(orgPermissionLabel).join(', ')}>
							<span>
								<Badge tone="rejected">
									<Icon name="shield" size={12} /> Org · {row.orgPermissions.length}
								</Badge>
							</span>
						</Tooltip>
					{:else}
						<Badge tone="rejected"><Icon name="shield" size={12} /> Org</Badge>
					{/if}
				{:else if row.role === 'Organizer'}
					<Badge tone="secondpass"><Icon name="shield" size={12} /> Organizer</Badge>
				{:else}
					<Badge>Reviewer</Badge>
				{/if}
			{:else if column.key === 'programs'}
				<ul class="programs">
					{#each row.programs as program (program)}
						<li>
							<Swatch color={programColors.get(program) ?? 'var(--text-3)'} size="sm" />{program}
						</li>
					{/each}
				</ul>
			{:else if row.pending}
				<Badge tone="pending"><Icon name="clock" size={12} /> Invited</Badge>
			{:else}
				<span class="last">{row.last}</span>
			{/if}
		{/snippet}
		{#snippet rowActions(row)}
			{@const items = menuFor(row)}
			{#if items.length}
				<Dropdown {items} align="end">
					{#snippet trigger(triggerProps)}
						<Button
							variant="quiet"
							size="sm"
							icon="dots"
							aria-label={`Actions for ${row.name}`}
							{...triggerProps}
						/>
					{/snippet}
				</Dropdown>
			{/if}
		{/snippet}
		{#snippet empty()}
			<EmptyState title="No people match" icon="user">
				{#if query.value.trim()}
					Nobody matches “{query.value.trim()}”.
				{:else}
					Nobody has the selected roles.
				{/if}
			</EmptyState>
		{/snippet}
	</DataTable>
</Card>

<Pagination
	page={currentPage}
	total={filtered.length}
	label="People pages"
	onPageChange={(next) => (pageNumber.value = next + 1)}
/>

{#if data.canManage}
	<InviteDialog
		bind:open={inviteOpen}
		programs={data.programs.filter((program) => !program.archived)}
		grantable={data.canGrant ? data.grantable : []}
	/>
{/if}

{#if data.canGrant}
	<OrgPermissionsDialog
		bind:open={permissionsOpen}
		person={permissionsFor}
		grantable={data.grantable}
	/>
{/if}

<ConfirmDialog
	bind:open={removeOpen}
	title={removeTarget?.pending ? 'Revoke invite?' : 'Remove from Ari?'}
	icon="user"
	tone="danger"
	confirmLabel={removeTarget?.pending ? 'Revoke invite' : 'Remove'}
	onConfirm={removePerson}
>
	<p class="confirm">
		{#if removeTarget?.pending}
			{removeTarget.email} will no longer get access when they sign in.
		{:else}
			{removeTarget?.name} ({removeTarget?.email}) loses their account, sessions and every program
			membership.
		{/if}
	</p>
</ConfirmDialog>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.search {
		flex: 1 1 220px;
		max-width: 320px;
	}
	.count {
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.confirm {
		margin: 0;
		color: var(--text-2);
	}
	.person {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 700;
	}
	.name,
	.email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.email,
	.last {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.programs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
	}
	.programs li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		white-space: nowrap;
	}
</style>
