<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import Note from '$lib/components/docs/Note.svelte';
	import RowList from '$lib/components/docs/RowList.svelte';
	import { accessRows } from '../toolRows';
	import { callReply, connectCommand, curlCall, openApiCall, restCall } from '../examples';

	let { endpoint }: { endpoint: string } = $props();
	const origin = $derived(endpoint.replace(/\/api\/mcp$/, ''));
</script>

<DocSection id="overview" title="Overview">
	<p class="docProse">
		Ari has an MCP server at <code>{endpoint}</code>. It reads programs, ships and reviews, and with
		a read-write token it can also set programs up: create one, change any of its settings, manage
		its organizers and review tools, upload its images, and issue its webhook signing secrets. Use
		it from an MCP client such as Claude Code, or from a script over plain HTTP, either as JSON-RPC
		or as one REST route per tool with an OpenAPI description.
	</p>
	<p class="docProse">
		Writes go through the same code as the settings pages, so the same checks apply and every change
		lands in the program's activity log under the token owner's name.
	</p>
</DocSection>

<DocSection id="connecting" title="Tokens and connecting">
	<p class="docProse">
		Anyone can create a token: open the menu under your avatar and pick <code>MCP</code>. Give it a
		label, pick when it expires (never, 30 days, 90 days or 1 year), and switch on
		<code>Read-write</code> if it should be able to change anything. You can also limit it to some
		of your programs. The token starts with <code>ari_mcp_</code> and is shown once, so copy it right
		away. Ari keeps only a hash.
	</p>
	<p class="docProse">
		A token acts as you. It sees and changes exactly what you can in the app, and Ari reads your
		access again on every request: if you lose a permission or leave a program, your tokens lose it
		at the same moment. Revoke a token from the same page. People with
		<code>MANAGE_MCP</code> can see and revoke everyone's tokens in <code>Admin → MCP</code>.
	</p>
	<CodeBlock title="Claude Code" tone="green" code={connectCommand(endpoint)} />
	<p class="docProse">
		Without an MCP client, send JSON-RPC 2.0 as a POST with the token as a bearer header. Call
		<code>tools/list</code> to see what the token can use, and <code>tools/call</code> to run a
		tool. The tool's result comes back as JSON text inside <code>result.content</code>.
	</p>
	<CodeBlock title="cURL" code={curlCall(endpoint)} />
	<CodeBlock title="Reply" code={callReply} />
	<Note>
		<p>
			A read-only token does not see the write tools in <code>tools/list</code>, and calling one
			anyway fails with <code>This token is read-only.</code>
		</p>
	</Note>
</DocSection>

<DocSection id="access" title="What a token can reach">
	<p class="docProse">
		Every tool follows the same rules as the page it matches. A program you cannot open reads as
		missing. Ships are limited to your tracks. Your own ships are hidden when the program hides
		them, and held or fraud-review ships stay hidden without <code>SECOND_PASS</code> or
		<code>VIEW_FRAUD</code>. Org operators reach every program; everyone else reaches the programs
		they are a member of.
	</p>
	<RowList rows={accessRows} />
	<p class="docProse">
		A token limited to some programs reaches only those, even if you could open more, and cannot use
		the org-wide tools: <code>create_program</code>, <code>set_org_permissions</code>,
		<code>list_users</code> and <code>get_user</code>. A refused call names the permission it
		needed.
	</p>
</DocSection>

<DocSection id="rest" title="REST and OpenAPI">
	<p class="docProse">
		Every tool can also be called as plain HTTP, with the same tokens. POST the tool's arguments as
		a JSON object to <code>/api/admin/tools/&lbrace;tool&rbrace;</code>, and the reply body is the
		tool's result. An empty body counts as no arguments.
	</p>
	<CodeBlock title="cURL" tone="green" code={restCall(origin)} />
	<p class="docProse">
		A refused call answers <code>400</code> with <code>&lbrace;"error": "..."&rbrace;</code> and
		saves nothing. A missing or rejected token is <code>401</code>, a write tool called with a
		read-only token is <code>403</code>, and an unknown tool name is <code>404</code>.
	</p>
	<p class="docProse">
		<code>/api/openapi.json</code> describes these routes as OpenAPI 3.1, built from the tool
		definitions, so it always matches the server. It is public: anyone can fetch it without a token,
		and it lists every tool, tagged <code>read</code> or <code>write</code>. Calling a tool still
		needs a token.
	</p>
	<CodeBlock title="cURL" code={openApiCall(origin)} />
</DocSection>
