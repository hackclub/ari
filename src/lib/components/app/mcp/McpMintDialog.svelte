<script lang="ts">
	import OptionGroup from '$lib/components/app/OptionGroup.svelte';
	import {
		Button,
		Checkbox,
		Dialog,
		SegmentedControl,
		Select,
		TextField,
		Toggle
	} from '$lib/components/ui';
	import { submitAction } from '$lib/actions';

	interface Props {
		open?: boolean;
		ownerEmail: string;
		programs: { id: string; name: string }[];
		onMinted: (minted: { token: string; label: string }) => void;
	}
	let { open = $bindable(false), ownerEmail, programs, onMinted }: Props = $props();

	let label = $state('');
	let days = $state('');
	let canWrite = $state(false);
	let reach = $state<'all' | 'some'>('all');
	let picked = $state<string[]>([]);
	let minting = $state(false);

	const limited = $derived(reach === 'some');

	function toggleProgram(id: string, on: boolean) {
		picked = on ? [...picked, id] : picked.filter((entry) => entry !== id);
	}

	async function mint() {
		if (minting || (limited && !picked.length)) return;
		minting = true;
		const result = await submitAction<{ token: string; label: string }>(
			'mint',
			{
				label: label.trim(),
				days,
				canWrite: canWrite ? 'on' : null,
				programIds: limited ? picked : []
			},
			{ errorToast: true, fallbackMessage: 'Could not create the token' }
		);
		minting = false;
		if (!result.ok || !result.data?.token) return;
		open = false;
		label = '';
		days = '';
		canWrite = false;
		reach = 'all';
		picked = [];
		onMinted({ token: result.data.token, label: result.data.label });
	}
</script>

<Dialog
	bind:open
	title="New token"
	description={`Acts as you (${ownerEmail}) and can never do more than you can. Shown once, copy it right away.`}
	icon="lock"
>
	<div class="form">
		<TextField
			label="Label"
			name="label"
			placeholder="e.g. my laptop"
			data-autofocus
			bind:value={label}
			onkeydown={(event) => event.key === 'Enter' && mint()}
		/>
		<Select
			label="Expires"
			name="days"
			options={[
				{ value: '', label: 'Never' },
				{ value: '30', label: '30 days' },
				{ value: '90', label: '90 days' },
				{ value: '365', label: '1 year' }
			]}
			bind:value={days}
		/>
		<Toggle
			label="Read-write"
			description="Allow write tools: change what you can change, such as program settings, review tools, members and signing secrets. Off means read-only."
			bind:checked={canWrite}
		/>
		<SegmentedControl
			label="Programs"
			bind:value={reach}
			options={[
				{ value: 'all', label: 'All my programs' },
				{ value: 'some', label: 'Only some', disabled: !programs.length }
			]}
		/>
		{#if limited}
			<OptionGroup label="Programs this token can reach" nested>
				{#each programs as program (program.id)}
					<Checkbox
						checked={picked.includes(program.id)}
						onchange={(event) => toggleProgram(program.id, event.currentTarget.checked)}
					>
						{program.name}
					</Checkbox>
				{/each}
			</OptionGroup>
			<p class="hint">A token limited to some programs cannot use org-wide tools.</p>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="quiet" disabled={minting} onclick={() => (open = false)}>Cancel</Button>
		<Button
			variant="primary"
			icon="plus"
			loading={minting}
			disabled={limited && !picked.length}
			onclick={mint}
		>
			Create token
		</Button>
	{/snippet}
</Dialog>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
</style>
