<script lang="ts">
	import type { Component } from 'svelte';
	import { formatClock, formatDuration, formatHoursApprox } from '$lib/time';
	import {
		Badge,
		Button,
		Card,
		EmptyState,
		Icon,
		iconPaths,
		Notice,
		Select,
		Swatch,
		TextField,
		ThemeToggle,
		type BadgeTone,
		type IconName
	} from '$lib/components/ui';

	const buttonVariants = ['primary', 'ghost', 'soft', 'quiet', 'ok', 'danger'] as const;
	const buttonSizes = ['sm', 'md', 'lg'] as const;
	const badgeTones: BadgeTone[] = [
		'pending',
		'processing',
		'approved',
		'changes',
		'rejected',
		'reverted',
		'withdrawn',
		'secondpass',
		'fraudreview',
		'neutral'
	];
	const iconNames = Object.keys(iconPaths) as IconName[];

	const sectionModules = import.meta.glob<{ default: Component }>('./sections/*.svelte', {
		eager: true
	});
	const sections = Object.entries(sectionModules)
		.sort(([first], [second]) => first.localeCompare(second))
		.map(([path, module]) => ({ path, component: module.default }));
</script>

<svelte:head><title>Styleguide · Ari</title></svelte:head>

<main class="styleguide">
	<header>
		<div>
			<h1>Styleguide</h1>
			<p>Every shared component. Screens are built from these and nothing else.</p>
		</div>
		<ThemeToggle showLabel />
	</header>

	<section>
		<h2>Button</h2>
		<Card>
			<div class="stack">
				{#each buttonSizes as size (size)}
					<div class="row">
						{#each buttonVariants as variant (variant)}
							<Button {variant} {size}>{variant}</Button>
						{/each}
					</div>
				{/each}
				<div class="row">
					<Button variant="primary" icon="check">With icon</Button>
					<Button iconAfter="arrowR">Icon after</Button>
					<Button disabled>Disabled</Button>
					<Button variant="primary" loading>Loading</Button>
					<Button href="/styleguide">Link</Button>
				</div>
			</div>
		</Card>
	</section>

	<section>
		<h2>Badge</h2>
		<Card>
			<div class="row">
				{#each badgeTones as tone (tone)}
					<Badge {tone} dot>{tone}</Badge>
				{/each}
			</div>
		</Card>
	</section>

	<section>
		<h2>Time</h2>
		<Card>
			<table>
				<thead>
					<tr
						><th>Seconds</th><th>formatDuration</th><th>formatClock</th><th>formatHoursApprox</th
						></tr
					>
				</thead>
				<tbody>
					{#each [45, 725, 5405, 8784, 43200] as seconds (seconds)}
						<tr>
							<td>{seconds}</td>
							<td>{formatDuration(seconds)}</td>
							<td>{formatClock(seconds)}</td>
							<td>{formatHoursApprox(seconds)}h</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Card>
	</section>

	<section>
		<h2>EmptyState</h2>
		<Card>
			<EmptyState title="Nothing waiting" icon="inbox">
				New ships appear here as soon as they are ingested.
				{#snippet actions()}
					<Button variant="primary">Refresh</Button>
				{/snippet}
			</EmptyState>
		</Card>
	</section>

	<section>
		<h2>Card</h2>
		<div class="row">
			<Card>Raised card</Card>
			<Card variant="flat">Flat card</Card>
			<Card backdrop="/flag.png">Card with a backdrop</Card>
		</div>
	</section>

	<section>
		<h2>TextField</h2>
		<Card>
			<div class="stack">
				<TextField label="Program name" name="programName" placeholder="Program 1" />
				<TextField
					label="Token"
					name="token"
					type="password"
					mono
					placeholder="ari_mcp_…"
					hint="Shown once when the token is minted."
				/>
				<TextField label="Disabled" name="disabledField" value="Read only" disabled />
			</div>
		</Card>
	</section>

	<section>
		<h2>Select</h2>
		<Card>
			<Select
				label="Program"
				name="program"
				value="summer"
				options={[
					{ value: 'summer', label: 'Program 1' },
					{ value: 'winter', label: 'Program 2' }
				]}
			/>
		</Card>
	</section>

	<section>
		<h2>Notice</h2>
		<div class="stack">
			<Notice>Nothing has changed since the last capture.</Notice>
			<Notice tone="danger">That token is invalid, revoked, or its owner lost MCP access.</Notice>
		</div>
	</section>

	<section>
		<h2>Swatch</h2>
		<div class="row">
			<Swatch color="#338eda" />
			<Swatch color="#ff8c37" size="sm" />
			<Swatch color="#338eda" src="/flag.png" />
			<Swatch color="#ff8c37" src="/flag.png" size="sm" />
			<Swatch color="#ec3750" src="/missing.png" />
		</div>
	</section>

	<section>
		<h2>Icon</h2>
		<Card>
			<div class="iconGrid">
				{#each iconNames as name (name)}
					<div class="iconCell"><Icon {name} /><span>{name}</span></div>
				{/each}
			</div>
		</Card>
	</section>
	{#each sections as section (section.path)}
		<section>
			<section.component />
		</section>
	{/each}
</main>

<style>
	.styleguide {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4) var(--space-7);
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	header p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	section {
		margin-top: var(--space-6);
	}
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 700;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-2);
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	th {
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	td {
		font-family: var(--font-mono);
	}
	.iconGrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: var(--space-3);
	}
	.iconCell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
</style>
