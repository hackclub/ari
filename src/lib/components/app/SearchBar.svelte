<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { Avatar, Icon, Popover, SearchField, Skeleton, type IconName } from '$lib/components/ui';
	import { formatDuration } from '$lib/time';

	interface PageLink {
		label: string;
		icon?: IconName;
		href: string;
	}
	interface Props {
		programId: string;
		program: string;
		tabs: PageLink[];
	}
	let { programId, program, tabs }: Props = $props();

	interface SubmissionHit {
		id: string;
		href: string;
		title: string;
		author: string;
		detail: string | null;
		slackId: string | null;
		color: string;
		evidenceSeconds: number;
	}
	interface PersonHit {
		href: string;
		name: string;
		email: string;
		color: string;
		slackId: string | null;
	}

	const uid = $props.id();
	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let inputElement = $state<HTMLInputElement>();
	let submissions = $state<SubmissionHit[]>([]);
	let people = $state<PersonHit[]>([]);
	// from the first keystroke, not the request: the pause before it is part of the wait
	let loading = $state(false);
	let failed = $state(false);

	const term = $derived(query.trim());
	const pages = $derived(
		term ? tabs.filter((tab) => tab.label.toLowerCase().includes(term.toLowerCase())) : []
	);
	const hitCount = $derived(submissions.length + people.length + pages.length);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let requestSequence = 0;

	async function search(searchTerm: string) {
		const sequence = ++requestSequence;
		let answered = false;
		try {
			const response = await fetch(`/p/${programId}/search?q=${encodeURIComponent(searchTerm)}`);
			const body = response.ok ? await response.json() : null;
			// a newer query is already on its way
			if (sequence !== requestSequence) return;
			if (body) {
				submissions = body.subs ?? [];
				people = body.people ?? [];
				activeIndex = 0;
				answered = true;
			}
		} catch {
			if (sequence !== requestSequence) return;
		}
		// a failed search keeps the previous results on screen, and says so
		failed = !answered;
		loading = false;
	}

	function reset() {
		clearTimeout(debounceTimer);
		requestSequence++;
		submissions = [];
		people = [];
		activeIndex = 0;
		loading = false;
		failed = false;
	}

	function onInput() {
		clearTimeout(debounceTimer);
		open = term.length > 0;
		activeIndex = 0;
		if (!term) return reset();
		loading = true;
		failed = false;
		debounceTimer = setTimeout(() => search(term), 180); // 180ms: a pause in typing
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open || hitCount === 0) return;
		if (event.key === 'ArrowDown') activeIndex = (activeIndex + 1) % hitCount;
		else if (event.key === 'ArrowUp') activeIndex = (activeIndex - 1 + hitCount) % hitCount;
		else if (event.key === 'Enter') document.getElementById(`${uid}-hit-${activeIndex}`)?.click();
		else return;
		event.preventDefault();
		document.getElementById(`${uid}-hit-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
	}

	function onShortcut(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const typing =
			target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
		const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
		if (!commandK && (event.key !== '/' || typing)) return;
		event.preventDefault();
		inputElement?.focus();
		inputElement?.select();
	}

	afterNavigate(() => {
		open = false;
		query = '';
		reset();
	});
</script>

<svelte:window onkeydown={onShortcut} />

<Popover bind:open block>
	{#snippet anchor()}
		<SearchField
			label="Search {program}"
			placeholder="Search {program}…"
			shortcutHint="/"
			role="combobox"
			aria-expanded={open}
			aria-controls="{uid}-results"
			aria-autocomplete="list"
			aria-activedescendant={open && hitCount ? `${uid}-hit-${activeIndex}` : undefined}
			bind:value={query}
			bind:element={inputElement}
			oninput={onInput}
			onfocus={() => (open = term.length > 0)}
			onkeydown={onKeydown}
		/>
	{/snippet}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs come resolved from the server and the nav tabs -->
	<div
		class={{ results: true, stale: loading }}
		id="{uid}-results"
		role="listbox"
		aria-label="Search results"
		aria-busy={loading}
	>
		{#if failed}
			<p class="none" role="status">Search is not answering. Try again in a moment.</p>
		{:else if loading && submissions.length + people.length === 0}
			<div class="group" role="status">Searching…</div>
			<!-- 3: about the height of a typical answer, so the list does not jump when it lands -->
			{#each { length: 3 }, row (row)}
				<div class="hit" aria-hidden="true">
					<Skeleton shape="circle" width="var(--space-5)" height="var(--space-5)" />
					<span class="copy pending">
						<Skeleton width="55%" />
						<Skeleton width="80%" />
					</span>
				</div>
			{/each}
		{:else if hitCount === 0}
			<p class="none">No results for “{term}”</p>
		{/if}
		{#if submissions.length}
			<div class="group" role="presentation">Submissions</div>
			{#each submissions as hit, index (hit.id)}
				<a
					class={{ hit: true, active: index === activeIndex }}
					id="{uid}-hit-{index}"
					role="option"
					aria-selected={index === activeIndex}
					tabindex="-1"
					href={hit.href}
					onpointerenter={() => (activeIndex = index)}
				>
					<Avatar name={hit.author} color={hit.color} slackId={hit.slackId} size="sm" decorative />
					<span class="copy">
						<span class="primary">{hit.title}</span>
						<span class="secondary">{hit.id} · {hit.author}</span>
						{#if hit.detail}<span class="secondary">{hit.detail}</span>{/if}
					</span>
					<span class="amount">{formatDuration(hit.evidenceSeconds)}</span>
				</a>
			{/each}
		{/if}
		{#if people.length}
			<div class="group" role="presentation">Reviewers</div>
			{#each people as hit, personIndex (hit.email)}
				{@const index = submissions.length + personIndex}
				<a
					class={{ hit: true, active: index === activeIndex }}
					id="{uid}-hit-{index}"
					role="option"
					aria-selected={index === activeIndex}
					tabindex="-1"
					href={hit.href}
					onpointerenter={() => (activeIndex = index)}
				>
					<Avatar name={hit.name} color={hit.color} slackId={hit.slackId} size="sm" decorative />
					<span class="copy">
						<span class="primary">{hit.name}</span>
						<span class="secondary">{hit.email}</span>
					</span>
				</a>
			{/each}
		{/if}
		{#if pages.length}
			<div class="group" role="presentation">Pages</div>
			{#each pages as hit, pageIndex (hit.href)}
				{@const index = submissions.length + people.length + pageIndex}
				<a
					class={{ hit: true, active: index === activeIndex }}
					id="{uid}-hit-{index}"
					role="option"
					aria-selected={index === activeIndex}
					tabindex="-1"
					href={hit.href}
					onpointerenter={() => (activeIndex = index)}
				>
					<Icon name={hit.icon ?? 'file'} size={16} />
					<span class="copy"><span class="primary">{hit.label}</span></span>
				</a>
			{/each}
		{/if}
	</div>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</Popover>

<style>
	.results {
		width: min(420px, calc(100vw - var(--space-4)));
		max-height: min(440px, 70vh);
		padding: var(--space-1);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.none {
		margin: 0;
		padding: var(--space-4) var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-2);
		text-align: center;
	}
	/* results of the previous keystroke stay readable while the next answer is on its way */
	.stale .hit {
		opacity: 0.55;
	}
	.pending {
		gap: var(--space-1);
	}
	.group {
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--text-3);
	}
	.hit {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		color: var(--text);
		text-decoration: none;
	}
	.hit :global(svg) {
		flex: none;
		color: var(--text-3);
	}
	.active {
		background: var(--surface-3);
	}
	.copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		line-height: 1.3;
	}
	.primary,
	.secondary {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.primary {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.secondary {
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.amount {
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-2);
	}
</style>
