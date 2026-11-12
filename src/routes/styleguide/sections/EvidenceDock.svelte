<script lang="ts">
	import EvidenceDock from '$lib/components/review/dock/EvidenceDock.svelte';
	import { Button, Card, Checkbox, SegmentedControl, type IconName } from '$lib/components/ui';
	import type { DockTileId } from '$lib/review/dockDefaults';

	interface DemoTile {
		id: DockTileId;
		label: string;
		icon: IconName;
		rows: number;
	}
	const demoTiles: DemoTile[] = [
		{ id: 'commits', label: 'Commits · 18', icon: 'commit', rows: 18 },
		{ id: 'elapsed', label: 'Lapse · 4', icon: 'film', rows: 4 },
		{ id: 'devlog', label: 'Devlog · 9', icon: 'book', rows: 9 },
		{ id: 'files', label: 'Files · 26', icon: 'folder', rows: 26 },
		{ id: 'history', label: 'Past reviews · 3', icon: 'clock', rows: 3 },
		{ id: 'pastprojects', label: 'Past projects · 5', icon: 'layers', rows: 5 },
		{ id: 'readme', label: 'README', icon: 'file', rows: 12 }
	];

	let unavailable = $state<DockTileId[]>([]);
	let track = $state<'software' | 'hardware'>('software');
	let programId = $state<'styleguideProgramOne' | 'styleguideProgramTwo'>('styleguideProgramOne');
	let current = $state<DockTileId | null>(null);
	let dockComponent = $state<EvidenceDock>();
	let shortcutLog = $state('');

	function setAvailable(tile: DockTileId, available: boolean) {
		unavailable = available
			? unavailable.filter((candidate) => candidate !== tile)
			: [...unavailable, tile];
	}
</script>

{#snippet fakeBody(tile: DemoTile)}
	<ul class="rows">
		{#each { length: tile.rows }, index (index)}
			<li>
				<span class="mono">{String(index + 1).padStart(2, '0')}</span>
				<span>{tile.label.replace(/ ·.*$/, '')} row {index + 1}</span>
			</li>
		{/each}
	</ul>
{/snippet}
{#snippet commitsBody()}{@render fakeBody(demoTiles[0])}{/snippet}
{#snippet elapsedBody()}{@render fakeBody(demoTiles[1])}{/snippet}
{#snippet devlogBody()}{@render fakeBody(demoTiles[2])}{/snippet}
{#snippet filesBody()}{@render fakeBody(demoTiles[3])}{/snippet}
{#snippet historyBody()}{@render fakeBody(demoTiles[4])}{/snippet}
{#snippet pastprojectsBody()}{@render fakeBody(demoTiles[5])}{/snippet}
{#snippet readmeBody()}{@render fakeBody(demoTiles[6])}{/snippet}

<h2>Evidence dock</h2>
<div class="stack">
	<Card>
		<div class="stack">
			<p class="note">
				Hold a tile header for a second to move it, drop it on another tile to group them into tabs,
				drag a bottom corner to resize. Every pointer gesture has a keyboard equivalent on the move
				button, the tabs and the corner handles. The layout is saved per user, program and track.
			</p>
			<div class="row">
				{#each demoTiles as tile (tile.id)}
					<Checkbox
						checked={!unavailable.includes(tile.id)}
						onchange={(event) => setAvailable(tile.id, event.currentTarget.checked)}
					>
						{tile.label.replace(/ ·.*$/, '')}
					</Checkbox>
				{/each}
			</div>
			<div class="row">
				<SegmentedControl
					label="Track"
					size="sm"
					bind:value={track}
					options={[
						{ value: 'software', label: 'Software' },
						{ value: 'hardware', label: 'Hardware' }
					]}
				/>
				<SegmentedControl
					label="Program"
					size="sm"
					bind:value={programId}
					options={[
						{ value: 'styleguideProgramOne', label: 'Program one' },
						{ value: 'styleguideProgramTwo', label: 'Program two' }
					]}
				/>
				{#each dockComponent?.shortcuts.slice(0, 3) ?? [] as shortcut (shortcut.id)}
					<Button
						size="sm"
						onclick={() => {
							shortcut.handler();
							shortcutLog = shortcut.label;
						}}
					>
						{shortcut.label} ({shortcut.defaultBinding})
					</Button>
				{/each}
			</div>
			<p class="note" data-dock-demo-current>
				Current tile: {current ?? 'none'}{shortcutLog ? ` · last shortcut: ${shortcutLog}` : ''}
			</p>
		</div>
	</Card>
	<div class="wide">
		<EvidenceDock
			bind:this={dockComponent}
			onSelect={(tile) => (current = tile)}
			scope={{ userId: 'styleguide', programId, track }}
			shortcutLabel={(index) => (index >= 0 && index < 9 ? String(index + 1) : '')}
			tiles={[
				{ ...demoTiles[0], available: !unavailable.includes('commits'), body: commitsBody },
				{ ...demoTiles[1], available: !unavailable.includes('elapsed'), body: elapsedBody },
				{ ...demoTiles[2], available: !unavailable.includes('devlog'), body: devlogBody },
				{ ...demoTiles[3], available: !unavailable.includes('files'), body: filesBody },
				{ ...demoTiles[4], available: !unavailable.includes('history'), body: historyBody },
				{
					...demoTiles[5],
					available: !unavailable.includes('pastprojects'),
					body: pastprojectsBody
				},
				{ ...demoTiles[6], available: !unavailable.includes('readme'), body: readmeBody }
			]}
		/>
	</div>
</div>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
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
		gap: var(--space-3);
	}
	/* the styleguide column is 960 wide; the dock needs about 1000 before it leaves its stacked layout */
	.wide {
		width: min(1360px, calc(100vw - var(--space-6)));
		margin-inline: calc((100% - min(1360px, calc(100vw - var(--space-6)))) / 2);
	}
	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-2);
	}
	.rows {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		list-style: none;
	}
	.rows li {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.rows li:last-child {
		border-bottom: 0;
	}
	.mono {
		font-family: var(--font-mono);
		color: var(--text-3);
	}
</style>
