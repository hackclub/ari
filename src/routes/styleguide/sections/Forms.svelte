<script lang="ts">
	import {
		Card,
		Checkbox,
		DurationField,
		Field,
		RangeField,
		SearchField,
		Select,
		Textarea,
		TextField,
		Toggle
	} from '$lib/components/ui';

	let slug = $state('Program 1');
	let auditNote = $state('');
	let description = $state('Grows as you type.\nTry adding a few more lines.');
	let track = $state('');
	let hours = $state('12');
	let tileColumns = $state(6);
	let creditedSeconds = $state<number | null>(5400);
	let rowSeconds = $state<number | null>(1800);

	let notifyReviewers = $state(true);
	let requireReauth = $state(false);

	const trackNames = ['Hardware', 'Web', 'Games'];
	let pickedTracks = $state<string[]>(['Web']);
	const allPicked = $derived(pickedTracks.length === trackNames.length);
	const somePicked = $derived(pickedTracks.length > 0 && !allPicked);

	const slugError = $derived(
		/^[a-z0-9]+$/.test(slug) ? null : 'Lowercase letters and digits only.'
	);
	// 20 matches the minlength on the audit note below. the rule trims, so the counter must too
	const auditNoteLength = (text: string) => text.trim().length;
	const auditNoteError = $derived(
		auditNote.length > 0 && auditNoteLength(auditNote) < 20 ? 'Say a little more about why.' : null
	);

	function toggleTrack(trackName: string, picked: boolean) {
		pickedTracks = picked
			? [...pickedTracks, trackName]
			: pickedTracks.filter((name) => name !== trackName);
	}
</script>

<h2>Forms</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>TextField</h3>
			<div class="columns">
				<TextField label="Program name" name="formsProgramName" placeholder="Program 1" />
				<TextField
					label="Slug"
					name="formsSlug"
					mono
					required
					bind:value={slug}
					hint="Used in URLs. Edit it to clear the error."
					error={slugError}
				/>
				<TextField label="Disabled" name="formsDisabled" value="Read only" disabled />
				<SearchField label="Search ships" placeholder="Search ships…" shortcutHint="/" />
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Textarea</h3>
			<div class="columns">
				<Textarea
					label="Audit note"
					name="formsAuditNote"
					bind:value={auditNote}
					minlength={20}
					counter
					countLength={auditNoteLength}
					required
					placeholder="Why are you overriding this decision?"
					hint="At least 20 characters. Recorded in the audit log."
					error={auditNoteError}
				/>
				<Textarea
					label="Feedback to the maker"
					name="formsFeedback"
					maxlength={280}
					placeholder="Shown to the maker with the decision."
				/>
				<Textarea
					label="Auto-grow"
					name="formsDescription"
					bind:value={description}
					autoGrow
					rows={2}
				/>
				<Textarea
					label="Disabled"
					name="formsDisabledNote"
					value="Locked after approval"
					disabled
				/>
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Select</h3>
			<div class="columns">
				<Select
					label="Track"
					name="formsTrack"
					bind:value={track}
					required
					hint="Reviewers only see ships in their tracks."
					error={track ? null : 'Pick a track.'}
					options={[
						{ value: '', label: 'Choose…' },
						...trackNames.map((name) => ({ value: name, label: name }))
					]}
				/>
				<Select
					label="Disabled"
					name="formsDisabledSelect"
					value="web"
					disabled
					options={[{ value: 'web', label: 'Web' }]}
				/>
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>RangeField</h3>
			<div class="columns">
				<RangeField
					label="Width"
					min={4}
					max={12}
					bind:value={tileColumns}
					valueLabel="{tileColumns}/12"
					valueText="{tileColumns} of 12 columns"
				/>
				<RangeField label="Disabled" min={0} max={10} value={3} disabled />
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>DurationField</h3>
			<div class="columns">
				<DurationField
					label="Credited time"
					name="formsCreditedTime"
					bind:seconds={creditedSeconds}
					maxSeconds={7200}
					hint="Type 1h 30m, 90m or 1:30:00. Capped at 2h. Stored as {creditedSeconds ??
						'no'} seconds."
				/>
				<DurationField
					label="Row time"
					name="formsRowTime"
					bare
					emptyAs="zero"
					bind:seconds={rowSeconds}
				/>
				<DurationField label="Disabled" name="formsDurationDisabled" seconds={600} disabled />
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Field around a custom control</h3>
			<Field label="Hours cap" id="formsHoursCap" hint="Field wires the label, hint and error ids.">
				{#snippet children(control)}
					<input
						id={control.id}
						type="range"
						min="1"
						max="40"
						aria-describedby={control.describedBy}
						bind:value={hours}
					/>
				{/snippet}
			</Field>
			<p class="note">{hours} hours</p>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Checkbox</h3>
			<Checkbox
				checked={allPicked}
				indeterminate={somePicked}
				onchange={(event) => (pickedTracks = event.currentTarget.checked ? [...trackNames] : [])}
			>
				All tracks
			</Checkbox>
			<div class="indented">
				{#each trackNames as trackName (trackName)}
					<Checkbox
						checked={pickedTracks.includes(trackName)}
						onchange={(event) => toggleTrack(trackName, event.currentTarget.checked)}
					>
						{trackName}
					</Checkbox>
				{/each}
			</div>
			<Checkbox checked disabled>Disabled and checked</Checkbox>
			<Checkbox disabled>Disabled</Checkbox>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Toggle</h3>
			<Toggle
				label="Notify reviewers"
				description="Post to the reviewers channel when a ship arrives."
				bind:checked={notifyReviewers}
			/>
			<Toggle label="Require re-authentication" bind:checked={requireReauth} />
			<Toggle label="Disabled" description="Managed by the organisation." checked disabled />
			<p class="note">
				notifyReviewers: {notifyReviewers}, requireReauth: {requireReauth}
			</p>
		</div>
	</Card>
</div>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.indented {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-left: var(--space-5);
	}
	.note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
</style>
