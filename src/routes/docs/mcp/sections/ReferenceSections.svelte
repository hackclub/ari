<script lang="ts">
	import CodeBlock from '$lib/components/docs/CodeBlock.svelte';
	import DocSection from '$lib/components/docs/DocSection.svelte';
	import RowList from '$lib/components/docs/RowList.svelte';
	import { errorReply } from '../examples';
	import { readTools, writeTools } from '../toolRows';
</script>

<DocSection id="tools" title="Tool reference">
	<p class="docProse">
		Every tool, with its arguments, is also listed by <code>tools/list</code>. These work with any
		token:
	</p>
	<RowList rows={readTools} />
	<p class="docProse">These need a read-write token:</p>
	<RowList rows={writeTools} />
</DocSection>

<DocSection id="errors" title="Errors">
	<p class="docProse">
		When a tool refuses a call, the reply is still a normal JSON-RPC result, with
		<code>isError: true</code> and the reason as text. Nothing is saved when a call is refused. A missing
		or rejected token gets an HTTP 401 instead, and an unknown tool name a JSON-RPC error.
	</p>
	<CodeBlock title="Refused call" code={errorReply} />
</DocSection>
