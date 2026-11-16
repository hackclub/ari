<script lang="ts">
	import { Button, Checkbox, Icon } from '$lib/components/ui';
	import { useReview } from '$lib/review/state/reviewPage.svelte';

	const { context, draft, validation, wizard } = useReview();
	const fixes = $derived(context.data.fixes);
	const verified = $derived(fixes.filter((fix) => draft.fixConfirmed(fix.reviewId)).length);
	const error = $derived(validation.errorFor('fixChecks'));
</script>

<section class={{ fixes: true, invalid: error !== null }} data-review-field="fixChecks">
	<h2>Requested changes · {verified} of {fixes.length} verified</h2>
	{#each fixes as fix (fix.reviewId)}
		{@const confirmed = draft.fixConfirmed(fix.reviewId)}
		<article class={{ fix: true, confirmed }} data-fix={fix.reviewId}>
			<header>
				<Icon name={confirmed ? 'check' : 'clock'} size={14} />
				<span class="title">
					Changes requested on v{fix.version} · {fix.reviewerName} · {fix.when}
				</span>
				<Button
					size="sm"
					variant="quiet"
					iconAfter="arrowR"
					href={context.shipHref(fix.shipId) ?? undefined}
					title="Open the v{fix.version} review"
				>
					Open
				</Button>
			</header>
			<div>
				<p class="caption">To maker · shared</p>
				<p class="text">{fix.note}</p>
			</div>
			{#if fix.audit}
				<div>
					<p class="caption"><Icon name="lock" size={11} /> Audit · internal</p>
					<p class="text internal">{fix.audit}</p>
				</div>
			{/if}
			<div class="confirm">
				<Checkbox
					checked={confirmed}
					disabled={!draft.checksEditable}
					onchange={(event) => {
						draft.setFixConfirmed(fix.reviewId, event.currentTarget.checked);
						wizard.advanceWhenChecklistDone();
					}}
				>
					{confirmed ? 'Verified as addressed' : 'I checked the project and this was addressed'}
				</Checkbox>
			</div>
		</article>
	{/each}
	{#if error}<p class="error">{error}</p>{/if}
</section>

<style>
	.fixes {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		border-radius: var(--radius-md);
	}
	.invalid {
		outline: 2px solid color-mix(in srgb, var(--color-red) 65%, transparent);
		outline-offset: var(--space-2);
	}
	h2 {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.fix {
		--tone: var(--color-orange);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--tone) 30%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--tone) 8%, var(--surface));
	}
	.confirmed {
		--tone: var(--color-green);
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--tone);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	p {
		margin: 0;
	}
	.caption {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.text {
		/* about eight lines, then it scrolls */
		max-height: 180px;
		overflow-y: auto;
		font-size: var(--text-sm);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.internal {
		color: var(--text-2);
	}
	.confirm {
		padding-top: var(--space-2);
		border-top: 1px solid color-mix(in srgb, var(--tone) 18%, var(--border));
	}
	.error {
		color: var(--color-red);
		font-size: var(--text-xs);
	}
</style>
