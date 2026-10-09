<script lang="ts">
	import {
		Avatar,
		Badge,
		Button,
		Card,
		ConfirmDialog,
		DataTable,
		Dialog,
		Dropdown,
		EmptyState,
		Icon,
		KeyValue,
		type DataTableColumn,
		type DropdownItem
	} from '$lib/components/ui';
	import { copyText, submitAction } from '$lib/actions';
	import { toast } from '$lib/toast.svelte';
	import McpMintDialog from './McpMintDialog.svelte';

	interface Token {
		id: string;
		label: string;
		last4: string;
		owner: string;
		ownerEmail: string;
		ownerColor: string;
		canWrite: boolean;
		programs: string[];
		state: 'active' | 'expired' | 'revoked';
		created: string;
		lastUsed: string | null;
		expires: string | null;
		parent: string | null;
	}

	interface Props {
		tokens: Token[];
		endpoint: string;
		programs: { id: string; name: string }[];
		ownerEmail: string;
		showOwner?: boolean;
		mintOpen?: boolean;
	}
	let {
		tokens,
		endpoint,
		programs,
		ownerEmail,
		showOwner = false,
		mintOpen = $bindable(false)
	}: Props = $props();

	const connectCommand = $derived(
		`claude mcp add ari --transport http ${endpoint} \\\n  --header "Authorization: Bearer YOUR_TOKEN"`
	);
	const connectItems = $derived([
		{ key: 'Endpoint', value: endpoint, mono: true, copy: true },
		{ key: 'Claude Code', value: connectCommand, mono: true, copy: true }
	]);

	const columns: DataTableColumn[] = $derived([
		{ key: 'label', label: 'Label', width: '1.8fr' },
		...(showOwner
			? [{ key: 'owner', label: 'Owner', width: '1.4fr', hideBelow: 'md' as const }]
			: [{ key: 'reach', label: 'Programs', width: '1.4fr', hideBelow: 'md' as const }]),
		{ key: 'state', label: 'Status', width: '110px' },
		{ key: 'lastUsed', label: 'Last used', width: '100px', hideBelow: 'sm' },
		{ key: 'expires', label: 'Expires', width: '110px', hideBelow: 'sm' }
	]);

	const reachLabel = (token: Token) =>
		token.programs.length ? token.programs.join(', ') : 'All programs';
	const agoLabel = (span: string) => (span === 'now' ? 'just now' : `${span} ago`);

	// the raw token lives here only while the reveal dialog is open
	let revealed = $state<{ token: string; label: string } | null>(null);
	let revealOpen = $state(false);
	let revokeOpen = $state(false);
	let revokeTarget = $state<Token | null>(null);

	function closeReveal() {
		revealOpen = false;
		revealed = null;
	}

	async function revoke() {
		if (!revokeTarget) return;
		const target = revokeTarget;
		const result = await submitAction('revoke', { id: target.id });
		if (!result.ok) throw new Error(result.message);
		toast.success(`Token "${target.label}" revoked`, { icon: 'lock' });
	}

	async function remove(token: Token) {
		const result = await submitAction('delete', { id: token.id }, { errorToast: true });
		if (result.ok) toast.success(`Token "${token.label}" deleted`, { icon: 'x' });
	}

	function menuFor(token: Token): DropdownItem[] {
		if (token.state === 'active')
			return [
				{
					label: 'Revoke',
					icon: 'lock',
					tone: 'danger',
					onSelect: () => {
						revokeTarget = token;
						revokeOpen = true;
					}
				}
			];
		return [{ label: 'Delete', icon: 'x', tone: 'danger', onSelect: () => remove(token) }];
	}
</script>

<Card>
	<div class="connect">
		<h2>Connect a client</h2>
		<KeyValue items={connectItems}>
			{#snippet value(item)}<code>{item.value}</code>{/snippet}
		</KeyValue>
	</div>
</Card>

<Card padded={false}>
	<DataTable label="MCP tokens" {columns} rows={tokens} rowKey={(token) => token.id} flush>
		{#snippet cell({ row, column })}
			{#if column.key === 'label'}
				<div class="token">
					<span class="name">
						{row.label}
						<Badge>{row.canWrite ? 'read-write' : 'read-only'}</Badge>
					</span>
					<span class="meta mono">…{row.last4} · created {agoLabel(row.created)}</span>
					{#if row.parent}
						<span class="meta">derived from {row.parent}</span>
					{/if}
					{#if showOwner}
						<span class="meta">{reachLabel(row)}</span>
					{/if}
				</div>
			{:else if column.key === 'reach'}
				<span class="meta">{reachLabel(row)}</span>
			{:else if column.key === 'owner'}
				<Avatar name={row.owner} color={row.ownerColor} size="sm" decorative />
				<span class="meta truncate">{row.ownerEmail}</span>
			{:else if column.key === 'state'}
				{#if row.state === 'active'}
					<Badge tone="approved"><Icon name="check" size={12} /> Active</Badge>
				{:else if row.state === 'expired'}
					<Badge tone="pending"><Icon name="clock" size={12} /> Expired</Badge>
				{:else}
					<Badge tone="rejected"><Icon name="lock" size={12} /> Revoked</Badge>
				{/if}
			{:else if column.key === 'lastUsed'}
				<span class="meta">{row.lastUsed ? agoLabel(row.lastUsed) : 'never'}</span>
			{:else}
				<span class="meta">{row.expires ?? 'never'}</span>
			{/if}
		{/snippet}
		{#snippet rowActions(row)}
			<Dropdown items={menuFor(row)} align="end">
				{#snippet trigger(triggerProps)}
					<Button
						variant="quiet"
						size="sm"
						icon="dots"
						aria-label={`Actions for ${row.label}`}
						{...triggerProps}
					/>
				{/snippet}
			</Dropdown>
		{/snippet}
		{#snippet empty()}
			<EmptyState title="No tokens yet" icon="lock">
				Create one to connect an MCP client.
			</EmptyState>
		{/snippet}
	</DataTable>
</Card>

<McpMintDialog
	bind:open={mintOpen}
	{ownerEmail}
	{programs}
	onMinted={(minted) => {
		revealed = minted;
		revealOpen = true;
	}}
/>

<Dialog
	bind:open={revealOpen}
	title="Token created"
	description={`“${revealed?.label ?? ''}” is shown only this once. Store it now.`}
	icon="check"
	tone="ok"
	dismissible={false}
>
	<code class="secret">{revealed?.token ?? ''}</code>
	{#snippet footer()}
		<Button variant="quiet" onclick={closeReveal}>Done</Button>
		<Button
			variant="primary"
			icon="clip"
			data-autofocus
			onclick={() => revealed && copyText(revealed.token, 'Token copied')}
		>
			Copy token
		</Button>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={revokeOpen}
	title="Revoke token?"
	icon="lock"
	tone="danger"
	confirmLabel="Revoke"
	onConfirm={revoke}
>
	<p class="confirm">
		“{revokeTarget?.label}” stops working on its next request. This cannot be undone.
	</p>
</ConfirmDialog>

<style>
	.confirm {
		margin: 0;
		color: var(--text-2);
	}
	.connect {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 700;
	}
	code {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: pre-wrap;
		word-break: break-all;
	}
	.secret {
		display: block;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		user-select: all;
	}
	.token {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-weight: 700;
	}
	.meta {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
