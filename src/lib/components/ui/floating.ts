export type FloatingSide = 'top' | 'bottom';
export type FloatingAlign = 'start' | 'center' | 'end';

export function placeFloating(
	anchor: HTMLElement,
	panel: HTMLElement,
	side: FloatingSide,
	align: FloatingAlign
) {
	const anchorRect = anchor.getBoundingClientRect();
	const panelWidth = panel.offsetWidth;
	// content height plus borders: clearing max-height to measure would reset the panel's scroll
	const panelHeight = panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
	const viewportWidth = document.documentElement.clientWidth;
	const roomAbove = anchorRect.top;
	const roomBelow = window.innerHeight - anchorRect.bottom;

	const needed = panelHeight + 14; // 14: the 6px gap to the anchor plus an 8px viewport margin
	const above =
		side === 'top'
			? roomAbove >= needed || roomAbove > roomBelow
			: roomBelow < needed && roomAbove > roomBelow;
	const room = above ? roomAbove : roomBelow;
	const height = Math.min(panelHeight, room - 14); // 14: same gap plus margin as above

	let left = anchorRect.left;
	if (align === 'end') left = anchorRect.right - panelWidth;
	if (align === 'center') left = anchorRect.left + (anchorRect.width - panelWidth) / 2;
	left = Math.max(8, Math.min(left, viewportWidth - panelWidth - 8)); // 8: viewport margin

	const top = above ? anchorRect.top - height - 6 : anchorRect.bottom + 6; // 6: gap to the anchor

	panel.style.maxHeight = `${Math.round(room - 14)}px`; // 14: gap plus margin again
	panel.style.left = `${Math.round(left)}px`;
	panel.style.top = `${Math.round(top)}px`;
	panel.dataset.side = above ? 'top' : 'bottom';
}
