<script lang="ts">
	import { TextField, Toggle } from '$lib/components/ui';
	import { parseReauthTtl } from '$lib/settingsRules';
	import type { SettingsForm } from '../settingsForm.svelte';
	import PriorityReviewFields from './PriorityReviewFields.svelte';
	import SettingGroup from '$lib/components/app/SettingGroup.svelte';
	import SettingSection from '$lib/components/app/SettingSection.svelte';

	interface Props {
		form: SettingsForm;
		canDisableJustification: boolean;
		priorityFormUrl: string | null;
	}
	let { form, canDisableJustification, priorityFormUrl }: Props = $props();

	// turning it off is an org-admin action; the save action enforces the same rule
	const justificationLocked = $derived(form.values.hoursJustification && !canDisableJustification);
</script>

<SettingSection
	title="Review workflow"
	description="How approvals flow once a ship reaches reviewers."
>
	<Toggle
		label="Can't review own projects"
		description="Reviewers can't see or open ships they're a maker on (solo or collaborator)."
		bind:checked={form.values.reviewersCannotReviewOwnProjects}
	/>
	<Toggle
		label="Hour deflation"
		description="Reviewers and organizers can decide to deflate the hours of a shipped project."
		bind:checked={form.values.allowDeflation}
	/>
	<Toggle
		label="Hours justification"
		description={justificationLocked
			? 'An approval needs the technical features that account for the hours, and any deflation needs a reason. Only an org admin who can manage programs can turn this off.'
			: 'An approval needs the technical features that account for the hours, and any deflation needs a reason. On for all programs by default.'}
		disabled={justificationLocked}
		bind:checked={form.values.hoursJustification}
	/>
	<Toggle
		label="Second pass review"
		description="Held reviewer decisions wait for an organizer's sign-off before going out to the program. Pick which kinds get held below."
		bind:checked={form.values.secondPass}
	/>
	{#if form.values.secondPass}
		<SettingGroup>
			<Toggle label="Hold approvals" bind:checked={form.values.secondPassApproved} />
			<Toggle label="Hold changes requests" bind:checked={form.values.secondPassChanges} />
			<Toggle label="Hold rejections" bind:checked={form.values.secondPassRejected} />
			<Toggle
				label="Organizers skip the hold"
				description="Decisions made by the people running the program (the point of contact, org operators, and members with every permission) go out right away instead of waiting for a second pass. Fraud review still applies: an approval it holds comes back through second pass. Turn this off to hold their decisions too."
				bind:checked={form.values.secondPassOrganizerBypass}
			/>
		</SettingGroup>
	{/if}
	<Toggle
		label="Priority review"
		description="Makers request priority review for their queued ships through a public form. Priority ships go first in the queue, and your webhook payloads say whether a ship was reviewed with priority."
		bind:checked={form.values.priorityReview}
	/>
	{#if form.values.priorityReview}
		<SettingGroup>
			<PriorityReviewFields {form} formUrl={priorityFormUrl} />
		</SettingGroup>
	{/if}
	<Toggle
		label="Re-authenticate before reviewing"
		description="Anyone opening a ship to review it must first re-verify themselves with Hack Club Auth"
		bind:checked={form.values.reviewerReauth}
	/>
	{#if form.values.reviewerReauth}
		<SettingGroup>
			<div class="narrow">
				<TextField
					label="Inactivity timeout (minutes)"
					name="reviewerReauthTtlMinutes"
					inputmode="numeric"
					bind:value={form.values.reviewerReauthTtlMinutes}
					error={parseReauthTtl(form.values.reviewerReauthTtlMinutes) === null
						? 'A whole number of minutes between 1 and 100000.'
						: null}
				/>
			</div>
			<p>
				After this many minutes with no activity from the reviewer, they'll be forced to
				re-authenticate.
			</p>
		</SettingGroup>
	{/if}
</SettingSection>

<style>
	.narrow {
		max-width: 240px;
	}
	p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
</style>
