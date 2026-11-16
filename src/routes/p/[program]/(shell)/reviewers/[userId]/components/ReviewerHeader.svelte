<script lang="ts">
	import TrackPill from '$lib/components/app/TrackPill.svelte';
	import { Avatar, Badge, Button, Card, Icon } from '$lib/components/ui';
	import { orgPermissionLabel } from '$lib/data';
	import type { PageData } from '../$types';

	interface Props {
		subject: PageData['subject'];
		programId: string;
	}
	let { subject, programId }: Props = $props();

	const accessLabel = $derived(
		subject.isPoc
			? 'Program POC'
			: subject.permissions.length === 0
				? 'Reviewer'
				: `${subject.permissions.length} permission${subject.permissions.length === 1 ? '' : 's'}`
	);
</script>

<div class="back">
	<Button variant="quiet" size="sm" icon="arrowL" href={`/p/${programId}/reviewers`}>
		All reviewers
	</Button>
</div>

<Card>
	<header class="identity">
		<Avatar name={subject.name} color={subject.color} slackId={subject.slackId} size="lg" />
		<div class="copy">
			<div class="nameRow">
				<h1>{subject.name}</h1>
				{#if subject.orgPermissions.length > 0}
					<span title={subject.orgPermissions.map(orgPermissionLabel).join(', ')}>
						<Badge><Icon name="shield" size={11} /> Org</Badge>
					</span>
				{/if}
				{#if subject.isPoc}
					<Badge tone="secondpass"><Icon name="shield" size={11} /> POC</Badge>
				{/if}
			</div>
			<div class="email">{subject.email}</div>
			<div class="facts">
				<span>{accessLabel}</span>
				<span class="tracks">
					{#if subject.isPoc}
						All tracks
					{:else if subject.tracks.length}
						{#each subject.tracks as track (track)}<TrackPill {track} />{/each}
					{:else}
						No tracks
					{/if}
				</span>
				<span>
					{subject.lastSeen === 'now' ? 'Active now' : `Last active ${subject.lastSeen} ago`}
				</span>
			</div>
		</div>
	</header>
</Card>

<style>
	.back {
		display: flex;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-width: 0;
	}
	.copy {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.nameRow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	h1 {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.email {
		font-size: var(--text-sm);
		color: var(--text-2);
		overflow-wrap: anywhere;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.tracks {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
