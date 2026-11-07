<script lang="ts">
	import { privateProvider } from '$private';
	import { programKey, soloHackatimeKey, type TimeSource } from '$lib/review/settlement';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import HoursBar from './HoursBar.svelte';
	import TimeRowEditor from './TimeRowEditor.svelte';

	const { context, draft, settlement } = useReview();

	const evidence = $derived(context.data.settlementEvidence);
	const HoursNotes = privateProvider.slots.reviewHoursNotes;
	const shipRef = $derived({ submissionId: context.ship.id, programId: context.programId });
	const solo = $derived(!context.data.collaborators);
	const recordedOnly = $derived(context.closed && !context.canEditHeld);
	const reviewerCut = $derived(settlement.reducedSeconds > 0 || settlement.deflateSeconds > 0);
	const cut = $derived(reviewerCut || settlement.deductedSeconds > 0);
	// a held or recorded decision that is not an approval credits nothing, whatever was logged
	const nothingCredited = $derived(
		context.closed && context.recorded !== null && context.recorded.decision !== 'approved'
	);
	const hasTime = $derived(settlement.capturedSeconds > 0 || settlement.approvedSeconds > 0);

	// the one row per source that is edited here, not in an evidence tile. collaborative ships
	// edit each person's hackatime row in the collaborator panel
	const editor = $derived.by(
		(): Partial<Record<TimeSource, { rowId: string; capturedSeconds: number; label: string }>> => {
			if (!draft.timeEditable) return {};
			return {
				...(solo && evidence.ship.hackatimeSeconds > 0
					? {
							hackatime: {
								rowId: soloHackatimeKey,
								capturedSeconds: evidence.ship.hackatimeSeconds,
								label: 'tracked Hackatime time'
							}
						}
					: {}),
				...(evidence.ship.programSeconds > 0
					? {
							program: {
								rowId: programKey,
								capturedSeconds: evidence.ship.programSeconds,
								label: 'program-added time'
							}
						}
					: {})
			};
		}
	);

	const projects = $derived(context.data.hackatimeProjects);
	// only known when every linked project carries its own figure
	const linkedSeconds = $derived(
		projects.length && projects.every((project) => project.seconds !== null)
			? projects.reduce((sum, project) => sum + (project.seconds ?? 0), 0)
			: null
	);
</script>

<section class="hours" data-review-region="hours">
	<h2>{recordedOnly ? 'Recorded time' : 'Logged time'}</h2>
	{#if hasTime}
		<p class="headline">
			<strong data-approved-seconds={settlement.approvedSeconds}>
				{formatDuration(settlement.approvedSeconds)}
			</strong>
			<span>
				{#if cut}
					{nothingCredited ? 'after cuts' : 'approved'} ·
					{formatDuration(settlement.capturedSeconds)} captured
				{:else}
					{recordedOnly && context.recorded?.decision === 'approved' ? 'approved' : 'logged'}
				{/if}
			</span>
		</p>
		<HoursBar />
		<ul>
			{#each settlement.sourceRows as row (row.source)}
				{@const edited = editor[row.source]}
				{#if row.source !== 'program' || row.capturedSeconds > 0}
					<li data-hours-source={row.source}>
						<span class={['dot', row.source]}></span>
						<span class="label">{row.label}</span>
						{#if edited}
							<TimeRowEditor
								kind={row.source === 'program' ? 'program' : 'hackatime'}
								{...edited}
							/>
						{:else}
							<span class="value">
								{formatDuration(row.reportedSeconds)}
								<!-- a minute-model review rounds up past the captured seconds: that is not a cut -->
								{#if row.reportedSeconds < row.capturedSeconds}
									<span class="captured">/ {formatDuration(row.capturedSeconds)}</span>
								{/if}
							</span>
						{/if}
					</li>
				{/if}
			{/each}
			{#if settlement.reducedSeconds > 0}
				<li data-hours-cut="rows">
					<span class="dot cut"></span>
					<span class="label">Taken off rows</span>
					<span class="value">−{formatDuration(settlement.reducedSeconds)}</span>
				</li>
			{/if}
			{#if settlement.deflateSeconds > 0}
				<li data-hours-cut="deflate">
					<span class="dot cut"></span>
					<span class="label">Deflated</span>
					<span class="value">−{formatDuration(settlement.deflateSeconds)}</span>
				</li>
			{/if}
			{#if settlement.deductedSeconds > 0}
				<li data-hours-cut="deduction" title="Set outside this review. It cannot be changed here.">
					<span class="dot cut"></span>
					<span class="label">{settlement.deductionLabel}</span>
					<span class="value">−{formatDuration(settlement.deductedSeconds)}</span>
				</li>
			{/if}
		</ul>
		{#if reviewerCut && !recordedOnly}
			<p class="note">
				<b>{formatDuration(settlement.approvedSeconds)}</b> credited of
				{formatDuration(settlement.capturedSeconds)} captured. Mention the difference in your audit note.
			</p>
		{/if}
	{:else}
		<div class="empty">
			<p class="emptyHead">
				<strong data-approved-seconds={settlement.approvedSeconds}>
					{formatDuration(settlement.approvedSeconds)}
				</strong>
				No captured evidence
			</p>
			<p>There is no Hackatime, devlog or timelapse evidence on this ship.</p>
			{#if linkedSeconds !== null && linkedSeconds > 0}
				<p>
					Linked Hackatime projects show <b>{formatDuration(linkedSeconds)} tracked</b> (raw activity
					across everyone on this ship, before timelapse overlap is removed), but none landed as evidence
					on this ship.
				</p>
			{:else if linkedSeconds === null && projects.length > 0}
				<p>
					Linked Hackatime projects are present, but tracked activity was not snapshotted for this
					ship.
				</p>
			{/if}
		</div>
	{/if}
	{#if context.data.hours.aiDiscountedSeconds > 0}
		<p class="note">
			<b>−{formatDuration(context.data.hours.aiDiscountedSeconds)}</b> already taken off the Hackatime
			time above before the capture landed.
		</p>
	{/if}
	{#if !context.data.rules.allowDeflation && !context.railLocked}
		<p class="note">This program credits the full captured time: reductions are off.</p>
	{/if}
	{#if HoursNotes}<HoursNotes ship={shipRef} />{/if}
</section>

<style>
	.hours {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 700;
		text-transform: uppercase;
	}
	p {
		margin: 0;
	}
	.headline {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--text-2);
		font-size: var(--text-sm);
	}
	strong {
		color: var(--text);
		font-size: var(--text-2xl);
		font-weight: 800;
		line-height: 1;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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
		font-size: var(--text-sm);
	}
	.dot {
		flex: none;
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--text-3);
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
	.value {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-2);
		white-space: nowrap;
	}
	.captured {
		color: var(--text-3);
	}
	.note {
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	b {
		color: var(--text);
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--color-orange) 30%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-orange) 8%, var(--surface));
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	.emptyHead {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--color-orange);
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.emptyHead strong {
		color: inherit;
	}
</style>
