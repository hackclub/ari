import { goto } from '$app/navigation';
import { page } from '$app/state';
import { safeReturnPath } from '$lib/returnPath';
import { reviewHref } from '$lib/shipList';
import { toast } from '$lib/toast.svelte';
import type { Decision } from '$lib/review/reviewRules';
import type { ReviewPageData, ReviewWarning } from '$lib/review/reviewTypes';

export type ReviewLoadData = ReviewPageData & {
	program: string;
	programId: string;
	user?: App.SessionUser | null;
};

// the load data and everything derived from it alone. reads follow invalidateAll and prev/next
// because every getter goes back to the page's current data
export class ReviewContext {
	readonly #read: () => ReviewLoadData;
	#liveWarnings = $state.raw<{ shipId: string; warnings: ReviewWarning[] } | null>(null);

	constructor(read: () => ReviewLoadData) {
		this.#read = read;

		// the private checks stream in after first paint: swap in what they found, or leave
		// when they screened the ship out of the queue
		$effect(() => {
			const checks = this.data.liveChecks;
			const shipId = this.ship.id;
			if (!checks) return;
			let current = true;
			void checks
				.then((result) => {
					if (!current) return;
					if (result.screened) {
						toast.error('This ship was screened out and left the queue');
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- built from the route's own program id
						void goto(this.queueHref);
						return;
					}
					if (result.warnings) this.#liveWarnings = { shipId, warnings: result.warnings };
				})
				.catch(() => {
					// the stream was cut by a navigation: keep the warnings already shown
				});
			return () => {
				current = false;
			};
		});
	}

	get data(): ReviewLoadData {
		return this.#read();
	}
	get ship() {
		return this.data.ship;
	}
	get programId(): string {
		return this.data.programId;
	}
	get programName(): string {
		return this.data.program;
	}
	get user(): App.SessionUser | null {
		return this.data.user ?? null;
	}
	get viewer() {
		return this.data.viewer;
	}
	get shipState() {
		return this.data.state;
	}
	get lock() {
		return this.data.lock;
	}
	get navigation() {
		return this.data.nav;
	}
	get recorded() {
		return this.data.recorded;
	}

	// changes when the rail has to start over: another ship, or this one reopened or decided
	readonly shipKey = $derived(
		`${this.ship.id}:${this.ship.status}:${this.data.recorded?.reviewId ?? ''}`
	);

	readonly isHardware = $derived(this.ship.track === 'hardware');
	readonly closed = $derived(this.data.state.closed);
	readonly secondPass = $derived(this.data.state.secondPass);
	readonly readOnly = $derived(this.data.lock.readOnly);
	readonly canEditHeld = $derived(this.data.state.canEditHeld);
	readonly heldByViewer = $derived(this.data.state.heldByViewer);
	// the wizard only runs while this viewer is actually reviewing an open ship
	readonly reviewing = $derived(!this.closed && !this.readOnly);
	readonly railLocked = $derived((this.closed && !this.canEditHeld) || this.readOnly);
	readonly timeLocked = $derived(this.railLocked || !this.data.rules.allowDeflation);
	readonly wantsJustification = $derived(this.data.rules.hoursJustification);
	readonly heldDecision = $derived<Decision | null>(
		this.secondPass ? (this.data.recorded?.decision ?? 'approved') : null
	);
	readonly warnings = $derived(
		this.#liveWarnings?.shipId === this.ship.id ? this.#liveWarnings.warnings : this.data.warnings
	);

	// commit links break on a trailing slash or .git
	readonly repoUrl = $derived(this.ship.repoUrl.replace(/\.git$/i, '').replace(/\/$/, ''));

	// the track filter the reviewer opened the ship under goes back to the list with them
	readonly #listQuery = $derived(this.data.nav.track ? `?track=${this.data.nav.track}` : '');
	readonly queueHref = $derived(`/p/${this.programId}/queue${this.#listQuery}`);
	readonly secondPassHref = $derived(`/p/${this.programId}/secondpass${this.#listQuery}`);
	// held ships step through the held list, so they leave towards it
	readonly listHref = $derived(this.secondPass ? this.secondPassHref : this.queueHref);
	readonly previousHref = $derived(this.shipHref(this.data.nav.previousId));
	readonly nextHref = $derived(this.shipHref(this.data.nav.nextId));
	// where a finished ship sends the reviewer: the next one in its list, else the list
	readonly advanceHref = $derived(this.nextHref ?? this.listHref);

	// another screen may ask to be returned to. only same-origin paths are honoured
	readonly returnHref = $derived(safeReturnPath(page.url.searchParams.get('back'), null));

	// where back and finish session go: the screen that sent the reviewer here, else the list
	readonly leaveHref = $derived(this.returnHref ?? this.listHref);

	// the list's track filter rides along so prev and next stay inside it
	shipHref(shipId: string | null): string | null {
		return shipId ? reviewHref(this.programId, shipId, this.data.nav.track) : null;
	}
}
