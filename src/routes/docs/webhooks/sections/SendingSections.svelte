<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import Endpoint from '$lib/components/docs/Endpoint.svelte';
	import Note from '$lib/components/docs/Note.svelte';
	import { curlSample, legacyCurlSample, sampleInSolo } from '../examples';

	let { baseUrl, programId }: { baseUrl: string; programId: string } = $props();
</script>

<DocSection id="endpoint" title="Endpoint">
	<p class="docProse">When a maker submits a project, send it here as a POST.</p>
	<Endpoint method="POST" {baseUrl} {programId} />
</DocSection>

<DocSection id="authentication" title="Signing requests">
	<p class="docProse">
		Every request has to be signed so Ari knows it really came from you. Take the current unix time
		in whole seconds and put it in the <code>X-Ari-Timestamp</code> header. Then build the string
		<code>timestamp.body</code>: the timestamp in decimal, a literal dot, and the exact bytes you
		are about to send. Compute an HMAC-SHA256 of that string with your signing secret and put the
		hex result in the <code>X-Ari-Signature</code> header. Sign the raw body, not a re-serialized
		copy, or the signatures will not match. Ari rejects a timestamp more than 300 seconds away from
		its own clock, so a captured request cannot be replayed later. Your secret lives in
		<code>Settings → Webhooks</code>, where you can also roll it if it ever leaks.
	</p>
	<Note>
		<p>
			Older integrations sign the raw body alone and send no <code>X-Ari-Timestamp</code> header. That
			legacy form still works, but it has no replay protection, so new integrations should send the timestamp.
		</p>
	</Note>
	<CodeBlock title="Legacy signature" code={legacyCurlSample} />
</DocSection>

<DocSection id="sending" title="Sending a ship">
	<p class="docProse">
		Send the ship as JSON with the signature header set. Any 2xx response means Ari accepted the
		latest data and will move the ship through processing into the review queue. Bodies up to 25 MB
		are accepted. Here is the whole thing end to end.
	</p>
	<CodeBlock title="cURL" tone="green" code={curlSample(`${baseUrl}/api/ingest/${programId}`)} />
	<CodeBlock title="ship.json" code={sampleInSolo} />
</DocSection>

<DocSection id="updates" title="Correcting a ship">
	<p class="docProse">
		A ship cannot be edited in place once Ari has it. While a ship is open (processing, held for
		fraud review, held for second pass, or in the queue), sending the same
		<code>external_id</code> again does not replace it: Ari answers
		<code>409 already_queued</code> with the open ship's id. The one exception is a retry. Resending
		the exact same bytes within an hour returns
		<code>200 duplicate</code> and changes nothing.
	</p>
	<p class="docProse">
		To correct a ship that has not been decided yet, withdraw it first, then send the fixed payload.
		That creates a fresh ship and gathers its evidence again. Ari's
		<code>version</code> for the project goes up by one, since it counts how many times the project
		has been shipped. The same thing happens after a decision: sending the
		<code>external_id</code> again ships the project again as a new version, and if the previous ship
		ended in changes requested, the new one keeps its old place in the queue.
	</p>
	<Note>
		<p>
			Older integrations send an <code>ingest_version</code> field to revise a ship in place. Ari
			currently ignores it: a resend with a higher
			<code>ingest_version</code> is still answered with
			<code>409 already_queued</code>. Keeping the field in your payload is harmless.
		</p>
	</Note>
</DocSection>
