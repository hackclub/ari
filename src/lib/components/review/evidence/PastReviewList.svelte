<script lang="ts">
	import StatusBadge from '$lib/components/app/StatusBadge.svelte';
	import { Avatar, Button, Dialog, EmptyState, Icon } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import EvidenceBody from './EvidenceBody.svelte';

	const { context, cursor, keybinds } = useReview();

	const reviews = $derived(context.data.pastReviews);
	// without this permission the server sends who, when and the decision, nothing else
	const canOpen = $derived(context.viewer.canViewReviewed);
	// the review being confirmed in the rail is already shown there in full
	const fixIds = $derived(new Set(context.data.fixes.map((fix) => fix.reviewId)));

	let openId = $state<string | null>(null);
	let dialogOpen = $state(false);
	const openIndex = $derived(reviews.findIndex((review) => review.reviewId === openId));
	const shown = $derived(openIndex >= 0 ? reviews[openIndex] : null);
	// an older review of the ship on screen has nowhere else to go
	const shownHref = $derived(
		shown && shown.shipId !== context.ship.id ? context.shipHref(shown.shipId) : null
	);

	$effect(() => {
		void context.ship.id;
		dialogOpen = false;
	});

	function open(index: number) {
		const review = reviews[index];
		if (!review || !canOpen) return;
		cursor.select('history', index);
		openId = review.reviewId;
		dialogOpen = true;
	}

	const step = (delta: number) =>
		open(Math.min(reviews.length - 1, Math.max(0, openIndex + delta)));

	$effect(() => cursor.registerRows('history', { count: () => reviews.length, open }));

	const reading = () => dialogOpen && shown !== null;
	$effect(() =>
		keybinds.registerShortcuts('evidence', [
			...(['ArrowLeft', 'ArrowUp'] as const).map((key) => ({
				id: `pastReviewPrevious${key}`,
				label: 'Open past review: previous',
				defaultBinding: key,
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => step(-1)
			})),
			...(['ArrowRight', 'ArrowDown'] as const).map((key) => ({
				id: `pastReviewNext${key}`,
				label: 'Open past review: next',
				defaultBinding: key,
				fixed: true,
				allowInDialog: true,
				when: reading,
				handler: () => step(1)
			}))
		])
	);
</script>

<EvidenceBody>
	{#each reviews as review, index (review.reviewId)}
		{@const current = cursor.isCurrent('history', index)}
		{@const condensed = fixIds.has(review.reviewId)}
		<div
			id={cursor.rowId('history', index)}
			class={{ reviewRow: true, current }}
			aria-current={current ? 'true' : undefined}
			onfocusin={() => cursor.select('history', index)}
		>
			<div class="head">
				<span class="tag">v{review.version} · {review.shipId}</span>
				<StatusBadge status={review.decision} />
				<span class="reviewer">
					<Avatar
						name={review.reviewerName}
						color={review.reviewerColor}
						slackId={review.reviewerSlackId}
						size="sm"
						decorative
					/>
					{review.reviewerName}
				</span>
				<span class="spacer"></span>
				{#if review.approvedSeconds !== null}
					<span class="approved" title="Approved time">
						{formatDuration(review.approvedSeconds)}
					</span>
				{/if}
				<span class="when">{review.when}</span>
				{#if canOpen}
					<Button
						size="sm"
						variant="quiet"
						iconAfter="arrowR"
						aria-label="Open the v{review.version} review by {review.reviewerName}"
						onclick={() => open(index)}>Open</Button
					>
				{/if}
			</div>
			{#if canOpen && !condensed}
				<dl class="notes">
					<div>
						<dt>To maker · shared</dt>
						<dd>{review.note}</dd>
					</div>
					{#each review.collaboratorNotes as personal (personal.name + personal.note)}
						<div>
							<dt>To {personal.name} · only them</dt>
							<dd>{personal.note}</dd>
						</div>
					{/each}
					<div>
						<dt><Icon name="lock" size={11} /> Audit · internal</dt>
						<dd class="audit">{review.audit}</dd>
					</div>
				</dl>
			{:else if !canOpen}
				<p class="restricted"><Icon name="lock" size={11} /> Review details are restricted</p>
			{/if}
		</div>
	{:else}
		<EmptyState title="No prior reviews" icon="clock">
			This is the first ship of the project.
		</EmptyState>
	{/each}
</EvidenceBody>

<Dialog
	bind:open={dialogOpen}
	title={shown ? `Review of v${shown.version} · ${shown.shipId}` : 'Past review'}
	description={shown ? `Reviewed ${shown.when}` : undefined}
	icon="clock"
>
	{#if shown}
		<div class="summary">
			<Avatar
				name={shown.reviewerName}
				color={shown.reviewerColor}
				slackId={shown.reviewerSlackId}
				decorative
			/>
			<div class="who">
				<strong>{shown.reviewerName}</strong>
				<StatusBadge status={shown.decision} />
			</div>
			<span class="spacer"></span>
			<div class="credited">
				<strong>{formatDuration(shown.approvedSeconds ?? 0)}</strong>
				<span>approved</span>
			</div>
		</div>
		<section>
			<h3>Message to maker · shared</h3>
			<p>{shown.note}</p>
		</section>
		{#each shown.collaboratorNotes as personal (personal.name + personal.note)}
			<section>
				<h3>To {personal.name} · only them</h3>
				<p>{personal.note}</p>
			</section>
		{/each}
		<section>
			<h3><Icon name="lock" size={12} /> Audit reason · internal</h3>
			<p class="audit">{shown.audit}</p>
		</section>
	{/if}
	{#snippet footer()}
		{#if shown}
			<span class="position">{openIndex + 1} / {reviews.length}</span>
			<Button
				size="sm"
				icon="arrowL"
				aria-label="Previous review"
				disabled={openIndex <= 0}
				onclick={() => step(-1)}
			/>
			<Button
				size="sm"
				icon="arrowR"
				aria-label="Next review"
				disabled={openIndex >= reviews.length - 1}
				onclick={() => step(1)}
			/>
			<span class="spacer"></span>
			{#if shownHref}
				<Button size="sm" href={shownHref} iconAfter="arrowR" data-autofocus>
					Open ship review
				</Button>
			{/if}
		{/if}
		<Button
			size="sm"
			variant="quiet"
			data-autofocus={shownHref ? undefined : true}
			onclick={() => (dialogOpen = false)}>Close</Button
		>
	{/snippet}
</Dialog>

<style>
	.reviewRow {
		margin: 0 calc(-1 * var(--space-2));
		padding: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.reviewRow:last-child {
		border-bottom: 0;
	}
	.reviewRow.current {
		border-radius: var(--radius-md);
		background: var(--surface-2);
		outline: 1px solid var(--text-3);
		outline-offset: -1px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.tag {
		padding: 2px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		overflow-wrap: anywhere;
	}
	.reviewer {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.spacer {
		flex: 1;
	}
	.approved,
	.position {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.approved {
		font-weight: 600;
	}
	.when,
	.position {
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.notes {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
	}
	dt,
	.restricted,
	h3 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 0 2px;
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	dd,
	section p {
		margin: 0;
		color: var(--text);
		font-size: var(--text-sm);
		line-height: 1.45;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.audit {
		color: var(--text-2);
	}
	.restricted {
		margin: var(--space-2) 0 0;
		font-weight: 400;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.who {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
	}
	.credited {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-family: var(--font-mono);
	}
	.credited span {
		color: var(--text-3);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
	}
	h3 {
		margin-bottom: var(--space-1);
		color: var(--text-2);
		font-size: var(--text-sm);
	}
	@container evidenceTile (max-width: 560px) {
		.head {
			flex-wrap: wrap;
		}
		.head .spacer {
			display: none;
		}
	}
</style>
