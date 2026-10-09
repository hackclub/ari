<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import FieldTable from '$lib/components/docs/FieldTable.svelte';
	import Note from '$lib/components/docs/Note.svelte';
	import { createArguments, createReply, updateArguments } from '../examples';
	import { settingsFields } from '../settingsFields';

	let { ingestBaseUrl }: { ingestBaseUrl: string } = $props();
</script>

<DocSection id="create" title="Creating a program">
	<p class="docProse">
		<code>create_program</code> does what the new-program wizard does. It needs a
		<code>name</code>, a <code>trackingStartsAt</code> date and a <code>reviewersChannel</code>.
		Everything else is optional: <code>accent</code> (<code>#rrggbb</code>),
		<code>evidence</code> (default <code>commits</code> and <code>elapsed</code>),
		<code>organizers</code> as a list of emails, <code>poc</code> for the point of contact, and
		<code>allowVms</code>.
	</p>
	<p class="docProse">
		Organizers who already have an Ari account become organizers straight away. Anyone else gets an
		invite that turns into organizer access the first time they sign in.
	</p>
	<p class="docProse">
		Put any of the settings below in <code>settings</code> to apply them in the same call. They are
		applied right after the program is created. If they are refused, the program still exists: the
		reply has <code>settingsApplied: false</code> and the reason in <code>settingsError</code>, so
		fix them with <code>update_program_settings</code> rather than creating the program again.
	</p>
	<CodeBlock title="create_program arguments" code={createArguments} />
	<CodeBlock title="Result" tone="green" code={createReply(ingestBaseUrl)} />
	<Note>
		<p>
			The token owner needs <code>CREATE_PROGRAMS</code> or <code>MANAGE_PROGRAMS</code>, and
			<code>MANAGE_PROGRAMS</code> to turn on <code>allowVms</code>. When Slack is set up on the
			instance, the Ari Slack app must already be in the reviewers channel and the token owner must
			be a member of it. <code>ingestEndpoint</code> is null when the instance has no webhooks service
			set up.
		</p>
	</Note>
</DocSection>

<DocSection id="settings" title="Changing settings">
	<p class="docProse">
		<code>update_program_settings</code> changes anything on the program's settings page. Send the
		<code>program</code> ID and only the settings you want to change: the rest stay as they are.
		<code>get_program_settings</code> returns the current settings under the same names, so you can read
		them, change a few, and send them back.
	</p>
	<p class="docProse">
		Values have to be the right type: true or false for switches and whole numbers for numbers, not
		strings. An empty string clears a text setting. A setting name Ari does not know is refused, and
		so is the whole change if any part of it fails, so nothing is half saved.
	</p>
	<CodeBlock title="update_program_settings arguments" code={updateArguments} />
	<FieldTable fields={settingsFields} />
	<p class="docProse">
		<code>update_program</code> covers what the admin edit dialog does: <code>name</code>,
		<code>accent</code>, <code>evidence</code>, <code>allowVms</code>, <code>secondPass</code>,
		<code>organizers</code> and <code>poc</code>. Like the settings tool it keeps whatever you leave
		out, and it needs <code>MANAGE_PROGRAMS</code> on the token owner.
	</p>
	<Note>
		<p>
			In <code>update_program</code>, <code>organizers</code> is the complete list: anyone not in it
			loses organizer access. To add one organizer without touching the others, call
			<code>add_member</code> with every program permission.
		</p>
	</Note>
</DocSection>
