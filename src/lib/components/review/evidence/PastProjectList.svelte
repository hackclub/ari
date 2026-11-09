<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Button, EmptyState, Icon, Lightbox, type LightboxItem } from '$lib/components/ui';
	import type { PastProject } from '$lib/review/reviewTypes';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';
	import EvidenceBody from './EvidenceBody.svelte';

	const { context } = useReview();

	const projects = $derived(context.data.pastProjects);
	// a name per row only helps when the list covers more than one maker
	const severalMakers = $derived(
		new Set(projects.map((project) => project.email.toLowerCase())).size > 1
	);

	// the ledger has no title column: the repository name is the closest honest label
	function titleOf(project: PastProject): string {
		try {
			const tail = new URL(project.codeUrl).pathname
				.replace(/\/+$/, '')
				.replace(/\.git$/i, '')
				.split('/')
				.filter(Boolean)
				.pop();
			if (tail) return tail;
		} catch {
			// not a url: try the demo next
		}
		try {
			return new URL(project.playableUrl).hostname;
		} catch {
			return project.programs[0] ?? 'Untitled project';
		}
	}

	const approvedOn = (project: PastProject) =>
		project.approvedAt
			? new Date(project.approvedAt).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				})
			: 'no approval date';

	const broken = new SvelteSet<string>();
	const pictured = $derived(
		projects.filter((project) => project.screenshotUrl && !broken.has(project.screenshotUrl))
	);
	const screenshots = $derived<LightboxItem[]>(
		pictured.map((project) => ({
			src: project.screenshotUrl,
			alt: `${titleOf(project)} screenshot`
		}))
	);
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	$effect(() => {
		void context.ship.id;
		lightboxOpen = false;
		broken.clear();
	});

	function show(project: PastProject) {
		lightboxIndex = Math.max(0, pictured.indexOf(project));
		lightboxOpen = true;
	}
</script>

<EvidenceBody>
	{#each projects as project, index (project.recordUrl + index)}
		{@const title = titleOf(project)}
		<article class="project">
			{#if project.screenshotUrl && !broken.has(project.screenshotUrl)}
				<button
					type="button"
					class="screenshot"
					aria-label="View the {title} screenshot full size"
					onclick={() => show(project)}
				>
					<img
						src={project.screenshotUrl}
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
						onerror={() => broken.add(project.screenshotUrl)}
					/>
				</button>
			{/if}
			<div class="copy">
				<div class="head">
					<h3>{title}</h3>
					{#each project.programs as program (program)}<span class="tag">{program}</span>{/each}
					{#if severalMakers && (project.makerName || project.email)}
						<span class="maker">{project.makerName ?? project.email}</span>
					{/if}
					<span class="spacer"></span>
					<span class="credited" title="Credited time"
						>{formatDuration(project.creditedSeconds)}</span
					>
					<span class="date">{approvedOn(project)}</span>
				</div>
				{#if project.description}<p>{project.description}</p>{/if}
				{#if project.hackatimeProjects.length}
					<div class="tracked">
						<Icon name="clock" size={11} /> Hackatime: {project.hackatimeProjects.join(', ')}
					</div>
				{/if}
				<div class="links">
					{#if project.codeUrl}
						<Button
							size="sm"
							icon="github"
							href={project.codeUrl}
							target="_blank"
							rel="noreferrer noopener">Repo</Button
						>
					{/if}
					{#if project.playableUrl}
						<Button
							size="sm"
							icon="play"
							href={project.playableUrl}
							target="_blank"
							rel="noreferrer noopener">Demo</Button
						>
					{/if}
					<Button
						size="sm"
						icon="external"
						href={project.recordUrl}
						target="_blank"
						rel="noreferrer noopener">Record</Button
					>
				</div>
			</div>
		</article>
	{:else}
		<EmptyState title="No past projects" icon="layers">
			Nothing this maker shipped before is on record.
		</EmptyState>
	{/each}
</EvidenceBody>

<Lightbox bind:open={lightboxOpen} bind:index={lightboxIndex} items={screenshots} />

<style>
	.project {
		display: flex;
		gap: var(--space-3);
		margin: 0 calc(-1 * var(--space-2));
		padding: var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.project:last-child {
		border-bottom: 0;
	}
	.screenshot {
		display: block;
		flex: none;
		align-self: flex-start;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		cursor: zoom-in;
	}
	.screenshot img {
		display: block;
		width: 118px;
		height: 74px;
		object-fit: cover;
	}
	.copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.tag {
		padding: 1px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-2);
		font-size: var(--text-xs);
	}
	.maker,
	.date,
	.tracked {
		color: var(--text-3);
		font-size: var(--text-xs);
	}
	.spacer {
		flex: 1;
	}
	.credited {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	p {
		margin: 0;
		color: var(--text-2);
		font-size: var(--text-sm);
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.tracked {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		overflow-wrap: anywhere;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: 2px;
	}
	@container evidenceTile (max-width: 390px) {
		.spacer {
			display: none;
		}
		.screenshot img {
			width: 84px;
			height: 54px;
		}
	}
</style>
