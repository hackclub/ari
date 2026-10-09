import { timingSafeEqual } from 'node:crypto';

// timingSafeEqual throws on unequal lengths, so the length check comes first
export function constantTimeEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left);
	const rightBytes = Buffer.from(right);
	return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
