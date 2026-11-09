<script lang="ts">
	import { Avatar, Button, Checkbox, SegmentedControl } from '$lib/components/ui';
	import { actionLabels, windowChoices, type ShipTimeline } from './shipTimeline.svelte';

	interface Props {
		timeline: ShipTimeline;
	}
	let { timeline }: Props = $props();
</script>

<div class="filters" data-review-region="timelineFilters">
	{#if timeline.people.length > 1}
		<div class="group">
			<span class="label">People</span>
			<div class="chips">
				{#each timeline.people as person (person.name)}
					{@const hidden = Boolean(timeline.hiddenPeople[person.name])}
					<Button
						size="sm"
						variant={hidden ? 'quiet' : 'soft'}
						aria-pressed={!hidden}
						title={hidden ? `Show ${person.name}'s activity` : `Hide ${person.name}'s activity`}
						onclick={() => (timeline.hiddenPeople[person.name] = !hidden)}
					>
						<Avatar
							name={person.name}
							color={person.color}
							slackId={person.slackId}
							size="sm"
							decorative
						/>
						<span class={{ off: hidden }}>{person.name}</span>
					</Button>
				{/each}
			</div>
		</div>
	{/if}
	{#if timeline.actionGroups.length > 1}
		<div class="group">
			<span class="label">Actions</span>
			<div class="chips">
				{#each timeline.actionGroups as group (group)}
					{@const hidden = Boolean(timeline.hiddenActions[group])}
					<Button
						size="sm"
						variant={hidden ? 'quiet' : 'soft'}
						aria-pressed={!hidden}
						onclick={() => (timeline.hiddenActions[group] = !hidden)}
					>
						<span class={{ off: hidden }}>{actionLabels[group]}</span>
					</Button>
				{/each}
			</div>
		</div>
	{/if}
	<div class="group">
		<span class="label">Time</span>
		<SegmentedControl
			label="Time window"
			size="sm"
			options={windowChoices}
			bind:value={timeline.window}
		/>
	</div>
	<div class="foot">
		{#if timeline.hasOpens}
			<Checkbox
				bind:checked={timeline.showOpens}
				title="Include when reviewers opened this ship and when those sessions ended"
			>
				Show ship opens
			</Checkbox>
		{/if}
		{#if timeline.activeFilterCount || timeline.showOpens}
			<Button size="sm" variant="quiet" onclick={() => timeline.resetFilters()}>
				Reset filters
			</Button>
		{/if}
	</div>
</div>

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.label {
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.chips,
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.foot {
		justify-content: space-between;
	}
	.off {
		color: var(--text-3);
		text-decoration: line-through;
	}
</style>
