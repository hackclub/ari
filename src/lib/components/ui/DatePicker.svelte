<script lang="ts">
	import { tick } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';
	import {
		addDays,
		addMonths,
		clampIso,
		monthWeeks,
		parseIso,
		todayIso,
		weekday
	} from './dateGrid';

	interface Props {
		label: string;
		name?: string;
		range?: boolean;
		value?: string;
		from?: string;
		to?: string;
		min?: string;
		max?: string;
		placeholder?: string;
		locale?: string;
		align?: 'start' | 'end';
		disabled?: boolean;
	}
	let {
		label,
		name,
		range = false,
		value = $bindable(''),
		from = $bindable(''),
		to = $bindable(''),
		min,
		max,
		placeholder = range ? 'Pick dates' : 'Pick a date',
		locale = 'en-US',
		align = 'start',
		disabled = false
	}: Props = $props();

	const uid = $props.id();
	let open = $state(false);
	let focusIso = $state('');
	let today = $state('');
	let gridElement = $state<HTMLTableElement>();

	const shortFormat = $derived(
		new Intl.DateTimeFormat(locale, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);
	const fullFormat = $derived(
		new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' })
	);
	const monthFormat = $derived(
		new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
	);

	function format(formatter: Intl.DateTimeFormat, iso: string) {
		const date = parseIso(iso);
		return date ? formatter.format(date) : '';
	}

	const weekdays = $derived(
		Array.from({ length: 7 }, (_empty, offset) => {
			const date = new Date(Date.UTC(2023, 0, 1 + offset)); // 1 january 2023 was a sunday
			return {
				short: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date),
				long: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date)
			};
		})
	);

	const display = $derived.by(() => {
		if (!range) return format(shortFormat, value);
		if (from && to) return `${format(shortFormat, from)} – ${format(shortFormat, to)}`;
		return from ? `From ${format(shortFormat, from)}` : '';
	});
	const weeks = $derived(monthWeeks(focusIso));

	function toggle() {
		if (open) {
			open = false;
			return;
		}
		today = todayIso();
		const selected = range ? to || from : value;
		focusIso = clampIso(parseIso(selected) ? selected : today, min, max);
		open = true;
	}

	function focusDay() {
		gridElement?.querySelector<HTMLElement>(`[data-iso="${focusIso}"]`)?.focus();
	}

	function stepMonth(count: number) {
		focusIso = clampIso(addMonths(focusIso, count), min, max);
	}

	async function dayKey(event: KeyboardEvent) {
		let next: string;
		if (event.key === 'ArrowLeft') next = addDays(focusIso, -1);
		else if (event.key === 'ArrowRight') next = addDays(focusIso, 1);
		else if (event.key === 'ArrowUp') next = addDays(focusIso, -7);
		else if (event.key === 'ArrowDown') next = addDays(focusIso, 7);
		else if (event.key === 'Home') next = addDays(focusIso, -weekday(focusIso));
		else if (event.key === 'End') next = addDays(focusIso, 6 - weekday(focusIso));
		else if (event.key === 'PageUp') next = addMonths(focusIso, event.shiftKey ? -12 : -1);
		else if (event.key === 'PageDown') next = addMonths(focusIso, event.shiftKey ? 12 : 1);
		else return;
		event.preventDefault();
		focusIso = clampIso(next, min, max);
		await tick();
		focusDay();
	}

	function pick(iso: string, close: () => void) {
		focusIso = iso;
		if (!range) {
			value = iso;
		} else if (!from || to) {
			from = iso;
			to = '';
			return;
		} else if (iso < from) {
			to = from;
			from = iso;
		} else {
			to = iso;
		}
		close();
	}

	function clear(close: () => void) {
		value = '';
		from = '';
		to = '';
		close();
	}

	function outOfBounds(iso: string) {
		return Boolean((min && iso < min) || (max && iso > max));
	}

	function isSelected(iso: string) {
		return range ? iso === from || iso === to : iso === value;
	}
</script>

<div class="datePicker">
	<span id="{uid}-label" class="label">{label}</span>
	<Popover
		bind:open
		{align}
		block
		id="{uid}-panel"
		role="dialog"
		aria-label="Choose {label.toLowerCase()}"
		onOpen={focusDay}
	>
		{#snippet anchor()}
			<button
				type="button"
				class={{ trigger: true, open }}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls="{uid}-panel"
				aria-labelledby="{uid}-label {uid}-value"
				{disabled}
				onclick={toggle}
			>
				<Icon name="calendar" size={16} />
				<span id="{uid}-value" class={{ value: true, empty: !display }}>
					{display || placeholder}
				</span>
				<Icon name="chevD" size={15} />
			</button>
		{/snippet}
		{#snippet children(close)}
			<div class="calendar">
				<div class="monthRow">
					<button
						type="button"
						class="monthStep"
						aria-label="Previous month"
						onclick={() => stepMonth(-1)}
					>
						<Icon name="arrowL" size={15} />
					</button>
					<div class="month" aria-live="polite">{format(monthFormat, focusIso)}</div>
					<button
						type="button"
						class="monthStep"
						aria-label="Next month"
						onclick={() => stepMonth(1)}
					>
						<Icon name="arrowR" size={15} />
					</button>
				</div>
				<table role="grid" aria-labelledby="{uid}-label" bind:this={gridElement}>
					<thead>
						<tr>
							{#each weekdays as day (day.long)}
								<th scope="col"><abbr title={day.long}>{day.short.slice(0, 2)}</abbr></th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each weeks as week, weekIndex (weekIndex)}
							<tr>
								{#each week as iso, dayIndex (dayIndex)}
									{#if iso}
										<td role="gridcell" aria-selected={isSelected(iso)}>
											<button
												type="button"
												class={{
													day: true,
													selected: isSelected(iso),
													inRange: range && Boolean(to) && iso > from && iso < to,
													today: iso === today
												}}
												data-iso={iso}
												tabindex={iso === focusIso ? 0 : -1}
												aria-label={format(fullFormat, iso)}
												aria-current={iso === today ? 'date' : undefined}
												disabled={outOfBounds(iso)}
												onkeydown={dayKey}
												onclick={() => pick(iso, close)}
											>
												{Number(iso.slice(8))}
											</button>
										</td>
									{:else}
										<td></td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
				<div class="footer">
					<Button variant="quiet" size="sm" onclick={() => clear(close)}>Clear</Button>
					<Button size="sm" disabled={outOfBounds(today)} onclick={() => pick(today, close)}>
						Today
					</Button>
				</div>
			</div>
		{/snippet}
	</Popover>
	{#if name && range}
		<input type="hidden" name="{name}From" value={from} />
		<input type="hidden" name="{name}To" value={to} />
	{:else if name}
		<input type="hidden" {name} {value} />
	{/if}
</div>

<style>
	.datePicker {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-2);
	}
	.trigger {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: var(--control-lg);
		padding: 0 var(--space-3);
		border: 1px solid var(--border-2);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text-3);
		font-family: var(--font-sans);
		font-size: var(--text-md);
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.trigger:focus-visible,
	.open {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--ring);
	}
	.trigger:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
	}
	.empty {
		color: var(--text-3);
	}

	.calendar {
		padding: var(--space-3);
	}
	.monthRow {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.month {
		flex: 1;
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: center;
	}
	.monthStep {
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
	}
	.monthStep:hover {
		background: var(--surface-3);
		color: var(--text);
	}
	table {
		border-collapse: separate;
		border-spacing: 2px;
	}
	th {
		padding: var(--space-1) 0;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-3);
	}
	abbr {
		text-decoration: none;
	}
	td {
		padding: 0;
	}
	.day {
		display: grid;
		place-items: center;
		width: var(--control-md);
		height: var(--control-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}
	.day:hover:not(:disabled) {
		background: var(--surface-3);
	}
	.day:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.today {
		box-shadow: inset 0 0 0 1px var(--border-2);
	}
	.inRange {
		background: var(--primary-soft);
	}
	.selected,
	.selected:hover:not(:disabled) {
		background: var(--primary);
		color: var(--on-primary);
	}
	.day:focus-visible {
		box-shadow: 0 0 0 3px var(--ring);
	}
	.footer {
		display: flex;
		justify-content: space-between;
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}
</style>
