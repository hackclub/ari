<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import Note from '$lib/components/docs/Note.svelte';
	import { resolve } from '$app/paths';
	import { imageArguments, privateArguments, secretReply, toolsArguments } from '../examples';

	let { ingestBaseUrl }: { ingestBaseUrl: string } = $props();
</script>

<DocSection id="review-tools" title="Checklist, fields and snippets">
	<p class="docProse">
		<code>set_review_tools</code> sets what reviewers work with: the <code>checklist</code>, custom
		review <code>fields</code>, and <code>snippets</code> they insert by typing
		<code>/name</code>. Each list you send replaces that list completely. To keep an existing item,
		include its <code>id</code> from <code>get_program_settings</code>. Items without an id are
		added, and items you leave out are deleted. Lists you do not send are not touched.
	</p>
	<p class="docProse">
		Checklist items and fields apply to both tracks unless you give <code>tracks</code>. A field's
		<code>type</code> is <code>checkbox</code>, <code>text</code>, <code>number</code>,
		<code>select</code> or <code>multiselect</code>, and the last two take <code>options</code>.
		Field keys must be unique and default to the label. Snippet names are lowercased into a slug,
		must be unique, and a body can be up to 5000 characters.
	</p>
	<CodeBlock title="set_review_tools arguments" code={toolsArguments} />
</DocSection>

<DocSection id="branding" title="Icon and card background">
	<p class="docProse">
		If the image is already hosted, set <code>iconUrl</code> or <code>cardBgUrl</code> with
		<code>update_program_settings</code>. To upload the file, send it base64 encoded to
		<code>upload_program_image</code> with <code>kind</code> set to <code>icon</code> or
		<code>cardBg</code>. Ari stores it and sets the program to the stored URL, which comes back as
		<code>url</code>. Images can be PNG, JPEG, GIF, WebP, AVIF or SVG, up to 8 MB.
	</p>
	<CodeBlock title="upload_program_image arguments" code={imageArguments} />
	<Note>
		<p>
			Uploading only works when image storage is set up on the instance. Without it the tool says
			so, and a URL is the way to go.
		</p>
	</Note>
</DocSection>

<DocSection id="webhooks-setup" title="Ingest and outbound webhooks">
	<p class="docProse">
		Every program gets an inbound signing secret when it is created, but nobody ever sees that one.
		Call <code>roll_ingest_secret</code> to get one you can use: it revokes the old secret and
		returns the new one together with the program's <code>ingestEndpoint</code>. For results going
		back to your program, set <code>outboundUrl</code> with <code>update_program_settings</code>,
		then call
		<code>roll_outbound_secret</code> for the secret that signs those deliveries.
	</p>
	<CodeBlock title="roll_ingest_secret result" tone="green" code={secretReply(ingestBaseUrl)} />
	<p class="docProse">
		A secret is returned only by the call that rolls it. <code>get_program_settings</code> shows the
		last four characters and nothing more, and the activity log records only that a secret was
		rolled. How to sign and verify requests with these secrets is in the
		<a href={resolve('/docs/webhooks')}>webhooks reference</a>.
	</p>
</DocSection>

<DocSection id="flags" title="Flags and fraud review">
	<p class="docProse">
		Flag rules, fraud review and the screening behind them belong to a separate part of Ari, so they
		are set through <code>privateSettings</code> on <code>update_program_settings</code> rather than
		named settings. <code>get_program_settings</code> returns the current ones under
		<code>privateSettings</code>. Send back the entries you want to change as strings: entries you
		leave out are not touched. <code>create_program</code> takes the same kind of values as
		<code>privateValues</code>, for what the wizard's own fraud and flag steps would record.
	</p>
	<CodeBlock title="update_program_settings arguments" code={privateArguments} />
	<Note>
		<p>
			A <code>privateSettings</code> entry cannot use the name of a public setting. Set those directly
			instead.
		</p>
	</Note>
</DocSection>
