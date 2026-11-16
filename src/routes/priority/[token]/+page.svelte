<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Mention from '$lib/components/app/Mention.svelte';
	import { Avatar, Button, Card, EmptyState, Icon, Notice } from '$lib/components/ui';
	import { toast } from '$lib/toast.svelte';
	import ShipChoice from './components/ShipChoice.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const program = $derived(data.program);
	const ships = $derived(data.ships);
	const requestable = $derived(ships.filter((ship) => !ship.priority));
	const markedShips = $derived(ships.filter((ship) => ship.priority));
	// stable sort: the server's oldest-first order holds within each group
	const ordered = $derived(
		[...ships].sort((first, second) => Number(first.priority) - Number(second.priority))
	);
	const allMarked = $derived(ships.length > 0 && requestable.length === 0);

	let selected = $state<string[]>([]);
	let submitting = $state(false);
	let justMarked = $state(0);

	const signInHref = $derived(
		`${resolve('/auth/login')}?priority=${encodeURIComponent(page.params.token ?? '')}`
	);

	const step = $derived(
		!data.open ? 'closed' : !data.ident ? 'verify' : justMarked ? 'done' : 'pick'
	);
	const verified = $derived(step === 'pick' || step === 'done');
	const prioritized = $derived(step === 'done' || allMarked);
	const steps = $derived([
		{
			text: 'Verify who you are with Hack Club Auth',
			live: step === 'verify',
			done: verified
		},
		{
			text: 'Pick which of your queued projects get priority',
			live: step === 'pick' && !allMarked,
			done: prioritized
		},
		{ text: 'Your project is now prioritized in the queue', live: false, done: prioritized }
	]);

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
	}
	const plural = (count: number) => `${count} project${count === 1 ? '' : 's'}`;
</script>

<svelte:head><title>{program.name} · Priority review · Ari</title></svelte:head>

<main class="priority">
	<header class="program">
		<Avatar name={program.name} src={program.iconUrl} color={program.color} size="lg" decorative />
		<div>
			<p class="programName">{program.name}</p>
			<p class="muted">Priority review form</p>
		</div>
	</header>

	<section class="intro">
		<h1>Request priority review</h1>
		<p class="muted">It takes less than a minute.</p>
		<ol class="steps">
			{#each steps as entry, index (entry.text)}
				<li class={{ live: entry.live, done: entry.done }}>
					<span class="dot">
						{#if entry.done}<Icon name="check" size={13} strokeWidth={3} />{:else}{index + 1}{/if}
					</span>
					{entry.text}
				</li>
			{/each}
		</ol>
	</section>

	{#if data.message}
		<Card variant="flat">
			<p class="noteTitle">A note from {program.name}</p>
			<p class="note">{data.message}</p>
		</Card>
	{/if}

	{#if form?.error}
		<div role="alert"><Notice tone="danger">{form.error}</Notice></div>
	{/if}

	{#if step === 'closed'}
		<Card>
			<EmptyState title="Priority review is closed" icon="lock">
				{program.name} isn't taking priority requests right now. Check back later, or ask the program
				if you think this is a mistake.
			</EmptyState>
		</Card>
	{:else if step === 'verify'}
		<Card>
			<div class="panel">
				<h2>Verify it's you</h2>
				<p class="muted">
					Sign in with Hack Club Auth so we know which projects are yours. Nothing about you is
					stored beyond the request itself.
				</p>
				<Button
					variant="primary"
					size="lg"
					block
					href={signInHref}
					iconAfter="arrowR"
					data-sveltekit-reload
				>
					Continue with Hack Club
				</Button>
			</div>
		</Card>
	{:else if prioritized}
		<Card>
			<div class="panel">
				<div class="doneHead">
					<span class="doneIcon"><Icon name="check" size={20} strokeWidth={2.6} /></span>
					<div>
						<h2>{justMarked ? "You're all set" : 'Every project has priority'}</h2>
						<p class="muted">
							{#if justMarked}
								Your project{justMarked === 1 ? ' is' : 's are'} now prioritized in the queue.
							{:else}
								All of your ships waiting for review in {program.name} are already prioritized.
							{/if}
						</p>
					</div>
				</div>
				<ul class="ships">
					{#each markedShips as ship (ship.id)}
						<li><ShipChoice {ship} /></li>
					{/each}
				</ul>
				{#if step === 'done' && requestable.length}
					<Button block onclick={() => (justMarked = 0)}>Pick more projects</Button>
				{/if}
			</div>
		</Card>
	{:else}
		<form
			method="POST"
			action="?/mark"
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					if (result.type === 'success') {
						const marked = Number(result.data?.marked ?? 0);
						if (marked) {
							justMarked = marked;
							toast.success(`Priority requested for ${plural(marked)}`);
						} else toast.info('Nothing new to mark');
						selected = [];
					}
					await update();
				};
			}}
		>
			<Card>
				<div class="panel">
					<div>
						<h2>Pick your projects</h2>
						<p class="muted">These are your ships waiting for review in {program.name}.</p>
					</div>
					{#if !ships.length}
						<EmptyState title="Nothing waiting for review" icon="inbox">
							None of your projects are waiting for review right now. Ship one first, then come back
							here.
						</EmptyState>
					{:else}
						<ul class="ships">
							{#each ordered as ship (ship.id)}
								<li>
									<ShipChoice
										{ship}
										checked={selected.includes(ship.id)}
										onToggle={() => toggle(ship.id)}
									/>
								</li>
							{/each}
						</ul>
						<!-- never gated on the ticked count: a page that has not hydrated still submits and
						     the server answers -->
						<Button variant="primary" size="lg" block type="submit" loading={submitting}>
							{selected.length
								? `Request priority review for ${plural(selected.length)}`
								: 'Request priority review'}
						</Button>
					{/if}
				</div>
			</Card>
		</form>
	{/if}

	{#if data.ident && verified}
		<footer>
			<span class="muted">Signed in as</span>
			<Mention
				name={data.ident.name ?? data.ident.email}
				color={program.color}
				slackId={data.ident.slackId}
				email={data.ident.email}
			/>
			<form
				method="POST"
				action="?/signout"
				use:enhance={() =>
					async ({ update }) => {
						justMarked = 0;
						await update();
					}}
			>
				<Button variant="quiet" size="sm" type="submit">Not you? Sign out</Button>
			</form>
		</footer>
	{/if}
</main>

<style>
	.priority {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		width: 100%;
		max-width: 560px;
		min-height: 100vh;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4) var(--space-7);
	}
	.program {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	p {
		margin: 0;
	}
	.programName {
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.muted {
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	h1 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1.1;
	}
	h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-md);
		font-weight: 600;
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: var(--space-4) 0 0;
		padding: 0;
		list-style: none;
	}
	.steps li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.dot {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: var(--space-5);
		height: var(--space-5);
		border: 1px solid var(--border-2);
		border-radius: var(--radius-full);
		background: var(--surface-2);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.steps .live {
		color: var(--text);
	}
	.live .dot {
		border-color: var(--primary);
		color: var(--primary);
	}
	.done .dot {
		border-color: color-mix(in srgb, var(--color-green) 45%, transparent);
		background: color-mix(in srgb, var(--color-green) 12%, transparent);
		color: var(--color-green);
	}
	.noteTitle {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.note {
		margin-top: var(--space-1);
		font-size: var(--text-sm);
		line-height: 1.6;
		color: var(--text-2);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.doneHead {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}
	.doneIcon {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: var(--control-lg);
		height: var(--control-lg);
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-green) 13%, transparent);
		color: var(--color-green);
	}
	.ships {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	.ships li {
		padding: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.ships li:last-child {
		border-bottom: 0;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}
</style>
