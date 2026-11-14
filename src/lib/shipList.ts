import { allTracks, type Track } from '$lib/data';
import { pageCountFor, tablePageSize } from '$lib/pagination';

export function trackParam(url: URL): Track | null {
	const raw = url.searchParams.get('track');
	return allTracks.find((track) => track === raw) ?? null;
}

// ?page is one-based for people; everything else counts from zero
export function pageParam(url: URL, total: number): number {
	const requested = Math.trunc(Number(url.searchParams.get('page') ?? '1'));
	if (!Number.isFinite(requested) || requested < 1) return 0;
	return Math.min(requested, pageCountFor(total, tablePageSize())) - 1;
}

export function pageSlice<Row>(rows: Row[], page: number): Row[] {
	return rows.slice(page * tablePageSize(), (page + 1) * tablePageSize());
}

// a decided ship with no review row (screened out, say) sorts by when it arrived
export function newestDecidedFirst<Ship extends { id: string; receivedAt: Date }>(
	ships: Ship[],
	decidedAt: Map<string, Date | null>
): Ship[] {
	const sortTime = (ship: Ship) => (decidedAt.get(ship.id) ?? ship.receivedAt).getTime();
	return [...ships].sort(
		(first, second) => sortTime(second) - sortTime(first) || first.id.localeCompare(second.id)
	);
}

export function listParam(url: URL, key: string, allowed: readonly string[]): string[] {
	const raw = url.searchParams.get(key);
	if (!raw) return [];
	return allowed.filter((value) => raw.split(',').includes(value));
}

// null or empty removes the key. changing a filter drops ?page unless it is set in the same call
export function listHref(url: URL, changes: Record<string, string | null>): string {
	const params = new URLSearchParams(url.searchParams);
	if (!('page' in changes)) params.delete('page');
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === '') params.delete(key);
		else params.set(key, value);
	}
	const query = params.toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

export const pageHref = (url: URL, page: number): string =>
	listHref(url, { page: page === 0 ? null : String(page + 1) });

// the review screen steps prev/next through the same track filter
export function reviewHref(programId: string, shipId: string, track: Track | null): string {
	return `/p/${programId}/review/${shipId}${track ? `?track=${track}` : ''}`;
}
