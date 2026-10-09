<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import Endpoint from '$lib/components/docs/Endpoint.svelte';
	import RowList from '$lib/components/docs/RowList.svelte';
	import { statusResponseSample, statusSample, withdrawSample } from '../examples';
	import { ingestResponses, phases, withdrawResponses } from '../rows';

	let { baseUrl, programId }: { baseUrl: string; programId: string } = $props();

	const endpoint = $derived(`${baseUrl}/api/ingest/${programId}`);
</script>

<DocSection id="withdraw" title="Withdrawing a ship">
	<p class="docProse">
		Sometimes a ship should come off the queue after you have already sent it. Maybe the maker
		retracted it on your side, maybe you posted it by mistake, or maybe it was a duplicate.
		Withdrawing lets your program pull a ship back before a reviewer decides it, so nobody spends
		time reviewing something that no longer counts.
	</p>
	<Endpoint method="POST" {baseUrl} {programId} suffix="/withdraw" />
	<p class="docProse">
		The request is signed exactly like an ingest request: an <code>X-Ari-Timestamp</code> header and
		an HMAC-SHA256 of <code>timestamp.body</code> with the same signing secret (or, in the legacy
		form, of the raw body alone with no timestamp header). The body just needs the
		<code>external_id</code> you sent when you ingested the ship. Ari uses it to find the open ship for
		that project and take it off the queue.
	</p>
	<CodeBlock title="cURL" tone="green" code={withdrawSample(endpoint)} />
	<p class="docProse">
		You can only withdraw a ship that is still open, meaning it is processing, held for fraud
		review, or in the queue (claimed or not) with no decision yet. A withdrawn ship moves to the
		<code>withdrawn</code> state, which is final. It disappears from the queue and reviewers no longer
		see it. Withdrawing does not block the project: the same external_id can ship again later, and that
		creates a fresh ship.
	</p>
	<p class="docProse">
		Withdrawing is for ships that have not been decided yet. Once a ship has been approved, had
		changes requested, or been rejected, you cannot withdraw it. To undo a decision that already
		went out, ask a reviewer to revert or requeue the ship from the review screen instead.
	</p>
	<RowList rows={withdrawResponses} />
</DocSection>

<DocSection id="status" title="Checking where a ship is">
	<p class="docProse">
		Ask Ari where a ship currently sits in the review flow. Useful for showing makers a live status
		on your side without waiting for the outcome webhook.
	</p>
	<Endpoint method="GET" {baseUrl} {programId} suffix="/status" />
	<p class="docProse">
		A GET request has no body for the usual signature to cover, so authenticate by sending your
		signing secret as a bearer token instead. Look a ship up by
		<code>external_id</code> to get the project's latest ship, or by
		<code>id</code> (the ship ID Ari returned when you ingested it) to get a specific one.
	</p>
	<CodeBlock title="cURL" tone="green" code={statusSample(endpoint)} />
	<CodeBlock title="Response" tone="green" code={statusResponseSample} />
	<p class="docProse">
		<code>version</code> is the number of times this project has been shipped.
		<code>phase</code> is one of the values below.
		<code>decision</code> is null until the ship is decided, then
		<code>approved</code>, <code>changes</code> or
		<code>rejected</code>. A ship with changes requested counts as reviewed until a reviewer picks
		it up again. Unknown lookups return
		<code>404</code>, and a missing or wrong token returns
		<code>401</code>.
	</p>
	<RowList rows={phases} />
</DocSection>

<DocSection id="responses" title="Response codes">
	<p class="docProse">Everything Ari can return when you send a ship.</p>
	<RowList rows={ingestResponses} />
</DocSection>
