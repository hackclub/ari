<script lang="ts" module>
	import type { IconName } from './iconPaths';

	export interface DropdownItem {
		label: string;
		icon?: IconName;
		href?: string;
		onSelect?: () => void;
		tone?: 'default' | 'danger';
		disabled?: boolean;
		selected?: boolean;
		separatorBefore?: boolean;
		detail?: string;
		color?: string;
		imageUrl?: string;
	}

	export interface DropdownTriggerProps {
		id: string;
		'aria-haspopup': 'menu' | undefined;
		'aria-expanded': boolean;
		'aria-controls': string | undefined;
		onclick: () => void;
		onkeydown: (event: KeyboardEvent) => void;
	}
</script>

<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';
	import Swatch from './Swatch.svelte';

	interface Props {
		open?: boolean;
		label?: string;
		icon?: IconName;
		variant?: ComponentProps<typeof Button>['variant'];
		size?: ComponentProps<typeof Button>['size'];
		items?: DropdownItem[];
		align?: 'start' | 'end';
		side?: 'top' | 'bottom';
		trigger?: Snippet<[DropdownTriggerProps, boolean]>;
		header?: Snippet<[() => void]>;
		children?: Snippet<[() => void]>;
		onOpen?: () => void;
	}
	let {
		open = $bindable(false),
		label,
		icon,
		variant = 'ghost',
		size = 'md',
		items = [],
		align = 'start',
		side = 'bottom',
		trigger,
		header,
		children: content,
		onOpen
	}: Props = $props();

	const uid = $props.id();
	let menuElement = $state<HTMLDivElement>();
	let focusLast = false;
	let typed = '';
	let typedAt = 0;

	function show(last: boolean) {
		focusLast = last;
		open = true;
		onOpen?.();
	}

	function triggerKey(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		if (!open) show(event.key === 'ArrowUp');
	}

	const triggerProps = $derived<DropdownTriggerProps>({
		id: `${uid}-trigger`,
		'aria-haspopup': items.length ? 'menu' : undefined,
		'aria-expanded': open,
		'aria-controls': open ? `${uid}-menu` : undefined,
		onclick: () => (open ? (open = false) : show(false)),
		onkeydown: triggerKey
	});

	function menuItems() {
		return [
			...(menuElement?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
		];
	}

	function focusMenu() {
		const targets = menuItems();
		(focusLast ? targets.at(-1) : targets[0])?.focus();
	}

	function menuKey(event: KeyboardEvent) {
		const targets = menuItems();
		if (!targets.length) return;
		const current = targets.indexOf(document.activeElement as HTMLElement);
		let next: number;
		if (event.key === 'ArrowDown') next = (current + 1) % targets.length;
		else if (event.key === 'ArrowUp') next = current <= 0 ? targets.length - 1 : current - 1;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = targets.length - 1;
		else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey) {
			// 500ms: a pause this long starts a new typeahead search
			typed = event.timeStamp - typedAt > 500 ? event.key : typed + event.key;
			typedAt = event.timeStamp;
			const needle = typed.toLowerCase();
			next = targets.findIndex((target) =>
				target.textContent?.trim().toLowerCase().startsWith(needle)
			);
			if (next === -1) return;
		} else return;
		event.preventDefault();
		targets[next]?.focus();
	}

	function select(item: DropdownItem, close: () => void) {
		close();
		item.onSelect?.();
	}
</script>

{#snippet itemContent(item: DropdownItem)}
	{#if item.imageUrl || item.color}
		<Swatch color={item.color ?? 'var(--border)'} src={item.imageUrl} size="sm" />
	{:else if item.icon}
		<Icon name={item.icon} size={16} />
	{/if}
	<span class="label">{item.label}</span>
	{#if item.detail}<span class="detail">{item.detail}</span>{/if}
	{#if item.selected}<Icon name="check" size={15} strokeWidth={2.4} />{/if}
{/snippet}

<Popover bind:open {side} {align} onOpen={focusMenu}>
	{#snippet anchor()}
		{#if trigger}
			{@render trigger(triggerProps, open)}
		{:else}
			<Button {variant} {size} {icon} iconAfter="chevD" {...triggerProps}>{label}</Button>
		{/if}
	{/snippet}
	{#snippet children(close)}
		<div class="dropdown">
			{@render header?.(close)}
			{#if items.length}
				<div
					id="{uid}-menu"
					class="menu"
					role="menu"
					tabindex="-1"
					aria-labelledby="{uid}-trigger"
					bind:this={menuElement}
					onkeydown={menuKey}
				>
					{#each items as item, index (index)}
						{#if item.separatorBefore}<div class="separator" role="separator"></div>{/if}
						{#if item.href && !item.disabled}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass an already-resolved path or an external url -->
							<a
								class={['item', item.tone, item.selected && 'selected']}
								role="menuitem"
								tabindex="-1"
								href={item.href}
								aria-current={item.selected ? 'true' : undefined}
								onclick={() => select(item, close)}
							>
								{@render itemContent(item)}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{:else}
							<button
								type="button"
								class={['item', item.tone, item.selected && 'selected']}
								role="menuitem"
								tabindex="-1"
								disabled={item.disabled}
								aria-current={item.selected ? 'true' : undefined}
								onclick={() => select(item, close)}
							>
								{@render itemContent(item)}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
			{@render content?.(close)}
		</div>
	{/snippet}
</Popover>

<style>
	.dropdown {
		min-width: 220px;
		padding: var(--space-1);
	}
	.menu {
		display: flex;
		flex-direction: column;
		outline: none;
	}
	.menu:focus-visible {
		box-shadow: none;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.item:hover:not(:disabled),
	.item:focus-visible {
		background: var(--surface-3);
		box-shadow: none;
	}
	.item:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.item :global(svg) {
		flex: none;
		color: var(--text-3);
	}
	.label {
		flex: 1;
		min-width: 0;
	}
	.detail {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.selected {
		background: var(--primary-soft);
		color: var(--primary);
	}
	.danger {
		color: var(--color-red);
	}
	.danger:hover:not(:disabled),
	.danger:focus-visible {
		background: var(--primary-soft);
	}
	.selected :global(svg),
	.danger :global(svg) {
		color: currentColor;
	}
	.separator {
		height: 1px;
		margin: var(--space-1);
		background: var(--border);
	}
</style>
