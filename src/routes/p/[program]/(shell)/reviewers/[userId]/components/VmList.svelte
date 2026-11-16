<script lang="ts">
	import { EmptyState, Icon, List, ListRow } from '$lib/components/ui';
	import { reviewHref } from '$lib/shipList';
	import type { PageData } from '../$types';
	import Section from './Section.svelte';

	interface Props {
		vms: PageData['vms'];
		programId: string;
		program: string;
		rangeActive: boolean;
	}
	let { vms, programId, program, rangeActive }: Props = $props();
</script>

<Section title="VMs launched" icon="code" flush={vms.length > 0}>
	{#if vms.length}
		<List flush>
			{#each vms as launch (launch.id)}
				<ListRow
					title={launch.title}
					href={launch.submissionId ? reviewHref(programId, launch.submissionId, null) : undefined}
				>
					{#snippet leading()}<Icon name="code" size={15} />{/snippet}
					<span class="type">{launch.type}</span>
					<span title={launch.ago}>{launch.when}</span>
				</ListRow>
			{/each}
		</List>
	{:else}
		<EmptyState
			title={rangeActive ? 'No VMs launched in this period' : `No VMs launched on ${program}`}
			icon="code"
		/>
	{/if}
</Section>

<style>
	.type {
		font-weight: 600;
		text-transform: capitalize;
	}
</style>
