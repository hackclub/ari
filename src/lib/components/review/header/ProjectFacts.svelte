<script lang="ts">
	import { privateProvider } from '$private';
	import { page } from '$app/state';
	import { copyText } from '$lib/actions';
	import { Badge, Button, Dropdown, Icon, Kbd, type DropdownItem } from '$lib/components/ui';
	import { evidenceLabel } from '$lib/data';
	import { useReview } from '$lib/review/state/reviewPage.svelte';
	import { formatDuration } from '$lib/time';

	const { context, keybinds } = useReview();
	const ship = $derived(context.ship);
	const projects = $derived(context.data.hackatimeProjects);
	const accepts = $derived(page.data.meta?.accepts ?? []);
	const evidence = $derived(context.data.evidence);
	const rawTime =
		'raw tracked activity, before timelapse overlap is removed, so it can exceed the credited Hackatime time';

	// the full address stays in the link: github reads as owner/repo, the rest as host and path
	function displayUrl(value: string): string {
		try {
			const url = new URL(value);
			const path = url.pathname.replace(/\/+$/, '');
			if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
				const [owner, repository] = path.split('/').filter(Boolean);
				if (owner && repository) return `${owner}/${repository.replace(/\.git$/i, '')}`;
			}
			return `${url.host}${path === '/' ? '' : path}`;
		} catch {
			return value;
		}
	}

	const openTab = (url: string) => window.open(url, '_blank', 'noopener');

	// only the principal repository was fetched: the others open as they are
	const repositoryItems = $derived<DropdownItem[]>([
		{
			label: displayUrl(context.repoUrl),
			icon: 'github',
			detail: 'principal',
			onSelect: () => openTab(context.repoUrl)
		},
		...ship.extraRepoUrls.map((url) => ({
			label: displayUrl(url),
			icon: 'github' as const,
			onSelect: () => openTab(url)
		}))
	]);

	// long project lists fold to the first 3
	let projectsExpanded = $state(false);
	const shownProjects = $derived(projectsExpanded ? projects : projects.slice(0, 3));

	const plural = (count: number, noun: string, many = `${noun}s`) =>
		`${count} ${count === 1 ? noun : many}`;
</script>

<dl class="facts" data-review-region="projectFacts">
	<div class="fact">
		<dt><Icon name="github" size={13} /> Repository</dt>
		<dd class="links">
			{#if context.repoUrl && ship.extraRepoUrls.length}
				<Dropdown align="end" items={repositoryItems}>
					{#snippet trigger(triggerProps)}
						<Button
							size="sm"
							variant="quiet"
							iconAfter="chevD"
							title={context.repoUrl}
							{...triggerProps}
						>
							<span class="url">{displayUrl(context.repoUrl)}</span>
							<span class="more">+{ship.extraRepoUrls.length}</span>
						</Button>
					{/snippet}
				</Dropdown>
				<span class="key"><Kbd keys={keybinds.label('repo')} title={keybinds.title('repo')} /></span
				>
			{:else if context.repoUrl}
				<Button
					size="sm"
					variant="quiet"
					iconAfter="external"
					href={context.repoUrl}
					target="_blank"
					rel="noreferrer noopener"
					title={context.repoUrl}
					data-review-link="repo"
				>
					<span class="url">{displayUrl(context.repoUrl)}</span>
				</Button>
				<span class="key"><Kbd keys={keybinds.label('repo')} title={keybinds.title('repo')} /></span
				>
			{:else}
				<span class="missing">Not provided</span>
			{/if}
			{#if context.repoUrl}
				<Button
					size="sm"
					variant="quiet"
					icon="clip"
					aria-label="Copy the repository address"
					title="Copy the repository address"
					onclick={() => copyText(context.repoUrl, 'Repository address copied')}
				/>
			{/if}
		</dd>
	</div>
	<div class="fact">
		<dt><Icon name="play" size={13} /> Live demo</dt>
		<dd class="links">
			{#if ship.demoUrl}
				{@const demoUrl = ship.demoUrl}
				<Button
					size="sm"
					variant="quiet"
					iconAfter="external"
					href={demoUrl}
					target="_blank"
					rel="noreferrer noopener"
					title={demoUrl}
					data-review-link="demo"
				>
					<span class="url">{displayUrl(demoUrl)}</span>
				</Button>
				<span class="key"><Kbd keys={keybinds.label('demo')} title={keybinds.title('demo')} /></span
				>
				<Button
					size="sm"
					variant="quiet"
					icon="clip"
					aria-label="Copy the live demo address"
					title="Copy the live demo address"
					onclick={() => copyText(demoUrl, 'Live demo address copied')}
				/>
			{:else}
				<span class="missing">Not provided</span>
			{/if}
		</dd>
	</div>
	{#if !context.data.collaborators}
		<!-- a collaborative ship lists each person's projects beside their time in the rail -->
		<div class="fact top">
			<dt><Icon name="clock" size={13} /> Hackatime projects</dt>
			<dd>
				{#if projects.length}
					{#each shownProjects as project (project.name)}
						{@const link = privateProvider.projectLink(
							context.data.privatePanels,
							project.name,
							null
						)}
						{#snippet label()}
							{project.name}
							<span class="tracked">
								· {project.seconds === null
									? 'Time unavailable'
									: `${formatDuration(project.seconds)} tracked`}
							</span>
						{/snippet}
						{#if link}
							<Button
								size="sm"
								iconAfter="external"
								href={link.href}
								target="_blank"
								rel="noreferrer noopener"
								title="{link.title}. The time is {rawTime}"
								data-review-project={project.name}
							>
								{@render label()}
							</Button>
						{:else}
							<span class="tag" title="The time is {rawTime}" data-review-project={project.name}>
								<Badge>{@render label()}</Badge>
							</span>
						{/if}
					{/each}
					{#if projects.length > 3}
						<Button
							size="sm"
							variant="quiet"
							onclick={() => (projectsExpanded = !projectsExpanded)}
						>
							{projectsExpanded ? 'Show less' : `+${projects.length - 3} more`}
						</Button>
					{/if}
				{:else}
					<span class="missing">No projects linked</span>
				{/if}
			</dd>
		</div>
	{/if}
	<div class="fact top">
		<dt><Icon name="layers" size={13} /> Evidence</dt>
		<dd>
			<span class="counts">
				{plural(evidence.commits.length, 'commit')} ·
				{plural(evidence.devlogs.length, 'journal entry', 'journal entries')} ·
				{plural(evidence.clips.length, 'timelapse')}
			</span>
			{#if accepts.length}
				<span class="accepts" title="The kinds of evidence this program accepts">
					<span class="missing">accepts</span>
					{#each accepts as kind (kind)}
						<Badge>{evidenceLabel(kind)}</Badge>
					{/each}
				</span>
			{/if}
		</dd>
	</div>
</dl>

<style>
	.facts {
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin: 0;
	}
	.fact {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-width: 0;
		min-height: var(--control-md);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.fact:last-child {
		border-bottom: 0;
	}
	.fact.top {
		align-items: flex-start;
	}
	dt {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-3);
		font-size: var(--text-xs);
		font-weight: 600;
		white-space: nowrap;
	}
	.top dt {
		padding-top: var(--space-1);
	}
	dd {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
		min-width: 0;
		margin: 0;
		font-size: var(--text-sm);
	}
	.links {
		flex-wrap: nowrap;
	}
	.url {
		min-width: 0;
		max-width: 190px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.more,
	.missing,
	.tracked,
	.counts {
		color: var(--text-3);
	}
	.missing,
	.counts {
		font-size: var(--text-xs);
	}
	.counts {
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.tag {
		display: inline-flex;
		min-width: 0;
	}
	.tracked {
		font-weight: 500;
	}
	.accepts {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
	}
	@media (max-width: 700px) {
		.key {
			display: none;
		}
		.url {
			max-width: 150px;
		}
	}
</style>
