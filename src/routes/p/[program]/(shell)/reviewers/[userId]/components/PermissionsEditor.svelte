<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { submitAction } from '$lib/actions';
	import EditAccessDialog from '$lib/components/app/reviewers/EditAccessDialog.svelte';
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Button, ConfirmDialog, Field, Icon, Notice } from '$lib/components/ui';
	import { programPermissions } from '$lib/data';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from '../$types';
	import Section from './Section.svelte';

	interface Props {
		subject: PageData['subject'];
		program: string;
		programId: string;
		isSelf: boolean;
		orgOperator: boolean;
	}
	let { subject, program, programId, isSelf, orgOperator }: Props = $props();

	let editOpen = $state(false);
	let removeOpen = $state(false);

	const member = $derived({
		userId: subject.id,
		name: subject.name,
		email: subject.email,
		tracks: subject.tracks,
		permissions: subject.permissions
	});

	// the server refuses self-removal, and only an org operator may remove the program poc
	const canRemove = $derived(!isSelf && (!subject.isPoc || orgOperator));

	async function remove() {
		const result = await submitAction(
			'remove',
			{},
			{ invalidate: false, errorToast: true, fallbackMessage: 'Could not remove reviewer' }
		);
		if (!result.ok) return false;
		toast.success(`${subject.name} removed from ${program}`);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- built from the program id in the current route
		await goto(`/p/${programId}/reviewers`);
	}
</script>

<Section title="Access on {program}" icon="shield">
	<div class="stack">
		{#if subject.isPoc}
			<Notice>
				{subject.name} is the program POC and holds every permission and all tracks. The POC is assigned
				from the <a href={resolve('/admin')}>admin page</a>.
			</Notice>
		{/if}

		<Field label="Permissions" id="profilePermissions">
			{#snippet children(control)}
				<ul class="permissions" id={control.id}>
					{#each programPermissions as permission (permission.key)}
						{@const granted = subject.isPoc || subject.permissions.includes(permission.key)}
						<li class={['permission', granted && 'granted']}>
							<span class="mark">
								<Icon name={granted ? 'check' : 'x'} size={13} strokeWidth={2.6} />
							</span>
							<span class="permissionCopy">
								<span class="permissionLabel">
									{permission.label}
									<span class="visuallyHidden">{granted ? '(granted)' : '(not granted)'}</span>
								</span>
								<span class="permissionDescription">{permission.description}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/snippet}
		</Field>

		<Field label="Review tracks" id="profileTracks">
			{#snippet children(control)}
				<div class="tracks" id={control.id}>
					{#if subject.isPoc}
						<span class="muted">All tracks (POC)</span>
					{:else if subject.tracks.length}
						{#each subject.tracks as track (track)}<TrackPill {track} />{/each}
					{:else}
						<span class="muted">No tracks</span>
					{/if}
				</div>
			{/snippet}
		</Field>

		{#if !subject.isPoc}
			<div>
				<Button variant="primary" icon="shield" onclick={() => (editOpen = true)}
					>Edit access</Button
				>
			</div>
		{/if}

		{#if canRemove}
			<div class="dangerZone">
				<div class="dangerCopy">
					<span class="dangerTitle">Remove from {program}</span>
					<span class="muted">
						Revokes {subject.name}'s access to this program. Their review history stays intact.
					</span>
				</div>
				<Button variant="danger" size="sm" icon="x" onclick={() => (removeOpen = true)}>
					Remove
				</Button>
			</div>
		{/if}
	</div>
</Section>

{#if !subject.isPoc}
	<EditAccessDialog bind:open={editOpen} {member} />
{/if}
{#if canRemove}
	<ConfirmDialog
		bind:open={removeOpen}
		tone="danger"
		icon="x"
		title="Remove this reviewer?"
		description={`${subject.name} loses access to ${program}. Their past reviews stay.`}
		confirmLabel="Remove"
		onConfirm={remove}
	/>
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.permissions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.permission {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		min-width: 0;
		color: var(--text-3);
	}
	.mark {
		display: grid;
		place-content: center;
		flex: none;
		width: var(--space-4);
		height: var(--space-4);
		margin-top: 2px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.granted .mark {
		background: color-mix(in srgb, var(--color-green) 18%, var(--surface));
		color: var(--color-green);
	}
	.permissionCopy {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.permissionLabel {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
	}
	.granted .permissionLabel {
		color: var(--text);
	}
	.permissionDescription {
		font-size: var(--text-xs);
		color: var(--text-2);
	}
	.visuallyHidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.tracks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.muted {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.dangerZone {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.dangerCopy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 200px;
	}
	.dangerTitle {
		font-size: var(--text-sm);
		font-weight: 600;
	}
</style>
