<script lang="ts">
	import { page } from '$app/state';
	import { Card, SegmentedControl, Tabs } from '$lib/components/ui';

	let queueView = $state<'open' | 'held' | 'done'>('open');
	let density = $state('comfortable');
	let reviewerTab = $state('overview');

	const linkedTab = $derived(page.url.searchParams.get('tab') ?? 'general');
</script>

<h2>Navigation</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<h3>SegmentedControl</h3>
			<div class="row">
				<SegmentedControl
					label="Queue view"
					bind:value={queueView}
					options={[
						{ value: 'open', label: 'Open', icon: 'inbox', badgeCount: 12 },
						{ value: 'held', label: 'Held', icon: 'clock', badgeCount: 3 },
						{ value: 'done', label: 'Done', icon: 'check' }
					]}
				/>
				<SegmentedControl
					label="Density"
					size="sm"
					bind:value={density}
					options={[
						{ value: 'comfortable', label: 'Comfortable' },
						{ value: 'compact', label: 'Compact' },
						{ value: 'dense', label: 'Dense', disabled: true }
					]}
				/>
				<SegmentedControl
					label="Disabled"
					value="week"
					disabled
					options={[
						{ value: 'week', label: 'Week' },
						{ value: 'month', label: 'Month' }
					]}
				/>
			</div>
			<p class="note">queueView: {queueView}, density: {density}</p>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Tabs, controlled</h3>
			<Tabs
				label="Reviewer sections"
				panelId="styleguideReviewerPanel"
				bind:value={reviewerTab}
				tabs={[
					{ value: 'overview', label: 'Overview', icon: 'chart' },
					{ value: 'reviews', label: 'Reviews', icon: 'layers', count: 48 },
					{ value: 'flags', label: 'Flags', icon: 'flag', count: 0 }
				]}
			/>
			<div id="styleguideReviewerPanel" role="tabpanel" aria-label={reviewerTab} class="note">
				Panel for {reviewerTab}
			</div>
		</div>
	</Card>

	<Card>
		<div class="stack">
			<h3>Tabs, links</h3>
			<Tabs
				label="Settings sections"
				value={linkedTab}
				tabs={[
					{ value: 'general', label: 'General', href: '?tab=general' },
					{ value: 'webhooks', label: 'Webhooks', href: '?tab=webhooks', count: 2 },
					{ value: 'tracks', label: 'Tracks', href: '?tab=tracks' }
				]}
			/>
			<p class="note">Selected from the URL: ?tab={linkedTab}</p>
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
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
</style>
