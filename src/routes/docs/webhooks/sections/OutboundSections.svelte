<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import FieldTable from '$lib/components/docs/FieldTable.svelte';
	import RowList from '$lib/components/docs/RowList.svelte';
	import { sampleOut, sampleOutCollab, sampleShipUpdated } from '../examples';
	import { outboundFields } from '../outboundFields';
	import { events, legacyTimeFields } from '../rows';
</script>

<DocSection id="how-it-works" title="How delivery works">
	<p class="docProse">
		Every time a reviewer edits, decides, or reverts a ship, Ari sends a signed POST to the
		destination URL you set in <code>Settings → Webhooks</code>. Each request carries three headers:
		<code>X-Ari-Signature</code> (an HMAC-SHA256 hex of
		<code>timestamp.delivery_id.body</code>, signed with your outbound secret, which is separate
		from the one you sign ingests with),
		<code>X-Ari-Timestamp</code> (unix seconds), and
		<code>X-Ari-Delivery-Id</code>. To trust a delivery, recompute the signature and compare it.
		Ignore anything older than 5 minutes, and use the delivery ID to skip retries you have already
		handled. A delivery counts as made on any 2xx answer within 10 seconds; redirects are not
		followed and count as failures. If your endpoint answers with a 4xx other than 408 or 429, Ari
		takes that as a rejection and does not retry. For everything else (timeouts, connection errors,
		5xx, 408, 429), Ari retries with growing delays (2s, 10s, 30s, 2m, 10m, 30m, 1h, 2h, 4h) before
		marking the delivery failed, so a destination that is down for a few hours still catches up.
		Deliveries queued while your endpoint is disabled or misconfigured in Settings, or while the
		program is archived, wait for up to 12 hours instead of failing. The delivery ID stays the same
		across retries, while a manual resend from the review screen is a new delivery with a new ID.
	</p>
</DocSection>

<DocSection id="events" title="Events">
	<p class="docProse">
		Ari sends one of these for every edit, decision, or revert. The last one,
		<code>review.fraud</code>, is special: you only get it if you turn on fraud review, and there is
		more on it below.
	</p>
	<RowList rows={events} />
</DocSection>

<DocSection id="payload" title="Payload">
	<p class="docProse">
		Review deliveries carry the current ship snapshot plus the reviewer's notes and custom fields. A
		ship edit is sent immediately with the same snapshot and the exact old/new values.
	</p>
	<CodeBlock title="ship.updated" code={sampleShipUpdated} />
	<CodeBlock title="review.approved" tone="green" code={sampleOut} />
	<CodeBlock title="review.approved (collaborative)" code={sampleOutCollab} />
	<FieldTable fields={outboundFields} />
	<p class="docProse">
		Ari no longer sends a generated record. <code>review.justification.unified_db_record</code> is
		gone from every delivery, resends included: build your own write-up from the fields above.
		<code>review.justification</code> now holds the evidence Ari captured (<code
			>hackatime_projects</code
		>, <code>hackatime_user_id</code>, <code>lapse_links</code>) and the reviewer's own words (<code
			>technical_features</code
		>, <code>deflation_reason</code>).
	</p>
</DocSection>

<DocSection id="time" title="Time fields">
	<p class="docProse">
		Ari settles approved time in whole seconds. <code>review.approved_seconds</code> and
		<code>review.seconds_breakdown</code> carry the exact figures, and every
		<code>collaborators[]</code> entry carries the same two fields for that person. New integrations should
		read the seconds fields.
	</p>
	<p class="docProse">
		The older <code>approved_minutes</code>, <code>approved_hours</code>, and
		<code>minutes_breakdown</code> keep their names, positions, and meaning. They are rounded views of
		the seconds, kept so existing integrations do not have to change:
	</p>
	<RowList rows={legacyTimeFields} />
	<p class="docProse">
		For example, a <code>seconds_breakdown</code> of 5429, 1830, 29, and 0 gives
		<code>approved_seconds</code> 7288, <code>approved_minutes</code> 121,
		<code>approved_hours</code> 2, and a <code>minutes_breakdown</code> of 90, 30, 1, and 0. The same
		rules apply per collaborator, from that person's seconds. Reviews decided before Ari settled in seconds
		keep the minute values they always had, and their seconds fields are those minutes × 60. Do not sum
		the rounded fields across people or sources and expect the seconds total; read the seconds fields
		when you need exact time.
	</p>
</DocSection>
