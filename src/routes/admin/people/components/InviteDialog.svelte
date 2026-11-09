<script lang="ts">
	import { Button, Checkbox, Dialog, Select, Swatch, Textarea } from '$lib/components/ui';
	import { submitAction } from '$lib/actions';
	import { orgPermissions, type OrgPermission } from '$lib/data';
	import { toast } from '$lib/toast.svelte';

	interface Props {
		open?: boolean;
		programs: { name: string; color: string }[];
		grantable: OrgPermission[];
	}
	let { open = $bindable(false), programs, grantable }: Props = $props();

	let emailText = $state('');
	let role = $state('Reviewer');
	let chosenPrograms = $state<string[]>([]);
	let chosenOrgPermissions = $state<OrgPermission[]>([]);
	let sending = $state(false);

	const emails = $derived([
		...new Set(
			emailText
				.split(/[\s,;]+/)
				.map((email) => email.trim().toLowerCase())
				.filter(Boolean)
		)
	]);
	const grantableOptions = $derived(
		orgPermissions.filter((permission) => grantable.includes(permission.key))
	);

	const toggled = <Value,>(list: Value[], value: Value) =>
		list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

	async function send() {
		sending = true;
		const result = await submitAction<{ invited: number }>(
			'invite',
			{ emails, role, orgPermissions: chosenOrgPermissions, programs: chosenPrograms },
			{ errorToast: true, fallbackMessage: 'Could not send invites' }
		);
		sending = false;
		if (!result.ok) return;
		const count = result.data?.invited ?? emails.length;
		toast.success(`${count} invite${count === 1 ? '' : 's'} sent`, { icon: 'msg' });
		emailText = '';
		role = 'Reviewer';
		chosenPrograms = [];
		chosenOrgPermissions = [];
		open = false;
	}
</script>

<Dialog
	bind:open
	title="Add people"
	description="Invite by Hack Club email. They get access the moment they sign in."
	icon="user"
>
	<div class="form">
		<Textarea
			label="Email addresses"
			name="emails"
			rows={3}
			placeholder="user1@example.com, user2@example.com"
			hint="Separate several with commas, spaces or new lines."
			data-autofocus
			bind:value={emailText}
		/>
		<Select
			label="Role"
			name="role"
			hint="Organizer grants every program permission; Reviewer grants none."
			options={[
				{ value: 'Reviewer', label: 'Reviewer' },
				{ value: 'Organizer', label: 'Organizer' }
			]}
			bind:value={role}
		/>
		<fieldset>
			<legend>Assign to programs</legend>
			{#if programs.length}
				<ul class="choices scroll">
					{#each programs as program (program.name)}
						<li>
							<Checkbox
								checked={chosenPrograms.includes(program.name)}
								onchange={() => (chosenPrograms = toggled(chosenPrograms, program.name))}
							>
								<span class="program"><Swatch color={program.color} size="sm" />{program.name}</span
								>
							</Checkbox>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="note">There are no programs yet.</p>
			{/if}
		</fieldset>
		{#if grantableOptions.length}
			<fieldset>
				<legend>Org permissions</legend>
				<ul class="choices">
					{#each grantableOptions as permission (permission.key)}
						<li>
							<Checkbox
								checked={chosenOrgPermissions.includes(permission.key)}
								onchange={() =>
									(chosenOrgPermissions = toggled(chosenOrgPermissions, permission.key))}
							>
								<span class="label">{permission.label}</span>
								<span class="note">{permission.description}</span>
							</Checkbox>
						</li>
					{/each}
				</ul>
			</fieldset>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="quiet" disabled={sending} onclick={() => (open = false)}>Cancel</Button>
		<Button
			variant="primary"
			icon="msg"
			loading={sending}
			disabled={emails.length === 0}
			onclick={send}
		>
			Send {emails.length} invite{emails.length === 1 ? '' : 's'}
		</Button>
	{/snippet}
</Dialog>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-2);
		padding: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.scroll {
		max-height: calc(var(--space-7) * 4);
		overflow-y: auto;
	}
	.program {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.label {
		display: block;
		font-weight: 600;
	}
	.note {
		display: block;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
</style>
