<script lang="ts">
	import { privateProvider } from '$private';
	import { tick } from 'svelte';
	import { Avatar, Button, DurationField, SegmentedControl, Textarea } from '$lib/components/ui';
	import type { TimeSource } from '$lib/review/settlement';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import TimeRowEditor from './TimeRowEditor.svelte';

	const { context, draft, settlement } = useReview();

	const people = $derived(settlement.people);
	const firstName = (name: string) => name.split(' ')[0];

	let selectedId = $state('');
	const active = $derived(people.find((person) => person.makerId === selectedId) ?? people[0]);
	const details = $derived(
		context.data.collaborators?.find((person) => person.makerId === active?.makerId) ?? null
	);
	const trackedSeconds = $derived(
		context.data.settlementEvidence.collaborators.find(
			(person) => person.makerId === active?.makerId
		)?.hackatimeSeconds ?? 0
	);

	const options = $derived(
		people.map((person) => ({
			value: person.makerId,
			label: `${firstName(person.name)} · ${formatDuration(person.reported.total)}`,
			icon: draft.value.collaboratorNotes[person.makerId]?.trim() ? ('msg' as const) : undefined
		}))
	);

	const sources: { source: TimeSource; label: string }[] = [
		{ source: 'hackatime', label: 'Hackatime' },
		{ source: 'journals', label: 'Devlogs' },
		{ source: 'lapse', label: 'Timelapses' },
		{ source: 'program', label: 'Program-added' }
	];

	// a person's own note box is opt-in, so the rail normally shows one note: the shared one
	let noteOpen = $state<Record<string, boolean>>({});
	const noteShown = $derived(
		active
			? noteOpen[active.makerId] || Boolean(draft.value.collaboratorNotes[active.makerId])
			: false
	);

	async function openNote(makerId: string) {
		noteOpen[makerId] = true;
		await tick();
		document.getElementById(`collaboratorNote-${makerId}`)?.focus();
	}
</script>

{#if active}
	<section class="collaborators" data-review-region="collaborators">
		<h2>Submitters · {people.length}</h2>
		<div class="picker">
			<SegmentedControl
				size="sm"
				label="Submitter"
				{options}
				value={active.makerId}
				onchange={(makerId) => (selectedId = makerId)}
			/>
		</div>
		<div class="panel" data-collaborator={active.makerId}>
			<p class="who">
				<Avatar name={active.name} slackId={active.slackId} size="sm" decorative />
				<span class="name">{active.name}</span>
				<span class="total" data-collaborator-seconds={active.reported.total}>
					{formatDuration(active.reported.total)}
					{#if active.reported.total !== active.captured.total}
						<span class="captured">/ {formatDuration(active.captured.total)}</span>
					{/if}
				</span>
			</p>
			<ul>
				{#each sources as { source, label } (source)}
					{#if source !== 'program' || active.captured.program > 0}
						<li>
							<span class={['dot', source]}></span>
							<span class="label">{label}</span>
							{#if source === 'hackatime' && draft.timeEditable && trackedSeconds > 0}
								<TimeRowEditor
									kind="hackatime"
									rowId={active.makerId}
									capturedSeconds={trackedSeconds}
									label="tracked Hackatime time for {active.name}"
								/>
							{:else}
								<span class="value">
									{formatDuration(active.reported[source])}
									{#if active.reported[source] !== active.captured[source]}
										<span class="captured">/ {formatDuration(active.captured[source])}</span>
									{/if}
								</span>
							{/if}
						</li>
					{/if}
				{/each}
			</ul>
			{#if details?.projects.length}
				<ul class="projects" aria-label="Hackatime projects of {active.name}">
					{#each details.projects as project (project.name)}
						{@const link = privateProvider.projectLink(
							context.data.privatePanels,
							project.name,
							active.makerId
						)}
						<li class={{ plain: !link }} data-review-project={project.name}>
							{#if link}
								<Button
									size="sm"
									iconAfter="external"
									href={link.href}
									target="_blank"
									rel="noreferrer noopener"
									title={link.title}
								>
									{project.name} · {formatDuration(project.seconds)}
								</Button>
							{:else}
								{project.name} · {formatDuration(project.seconds)}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if context.data.rules.allowDeflation}
				<DurationField
					label="Deflate {firstName(active.name)}'s time"
					name="collaboratorDeflate-{active.makerId}"
					placeholder="none"
					hint={active.deflateSeconds > 0
						? `Cut from their total only: ${formatDuration(active.reported.total)} of ${formatDuration(active.settled.total)}.`
						: `Cut from their total only, up to ${formatDuration(active.settled.total)}.`}
					disabled={!draft.timeEditable}
					seconds={draft.value.collaboratorDeflates[active.makerId] ?? null}
					maxSeconds={active.settled.total}
					onCommit={(seconds) => draft.setCollaboratorDeflate(active.makerId, seconds)}
				/>
			{/if}
			{#if noteShown}
				<Textarea
					id="collaboratorNote-{active.makerId}"
					name="collaboratorNote-{active.makerId}"
					label="Note to {firstName(active.name)}"
					hint="Only they receive it. Optional: the shared note covers everyone else."
					autoGrow
					rows={2}
					readonly={!draft.editable}
					value={draft.value.collaboratorNotes[active.makerId] ?? ''}
					oninput={(event) => draft.setCollaboratorNote(active.makerId, event.currentTarget.value)}
				/>
			{:else if draft.editable}
				<div>
					<Button size="sm" variant="quiet" icon="lock" onclick={() => openNote(active.makerId)}>
						Add a note just for {firstName(active.name)}
					</Button>
				</div>
			{/if}
			{#if people.some((person) => person.deflateSeconds > 0)}
				<p class="across">
					−{formatDuration(settlement.deflateSeconds)} across everyone →
					{formatDuration(settlement.approvedSeconds)} approved
				</p>
			{/if}
		</div>
	</section>
{/if}

<style>
	.collaborators {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.picker {
		max-width: 100%;
		overflow-x: auto;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}
	p {
		margin: 0;
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.total,
	.value {
		font-family: var(--font-mono);
		font-weight: 600;
		white-space: nowrap;
	}
	.value {
		color: var(--text-2);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.captured {
		color: var(--text-3);
		font-weight: 600;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-height: var(--control-sm);
		font-size: var(--text-xs);
	}
	.dot {
		flex: none;
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-sm);
	}
	.hackatime {
		background: var(--color-blue);
	}
	.journals {
		background: var(--color-purple);
	}
	.lapse {
		background: var(--color-orange);
	}
	.program {
		background: var(--color-green);
	}
	.label {
		flex: 1 0 auto;
		font-weight: 600;
	}
	li :global(.timeRowEditor) {
		margin-left: auto;
	}
	.projects {
		flex-flow: row wrap;
	}
	.projects li {
		min-height: 0;
		font-family: var(--font-mono);
	}
	.projects li :global(.button) {
		font-family: inherit;
	}
	.projects .plain {
		padding: 1px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-2);
	}
	.across {
		color: var(--text-2);
		font-size: var(--text-xs);
	}
</style>
