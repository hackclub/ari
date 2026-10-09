import { createHmac } from 'node:crypto';

// ssrf guard: by literal only, dns is not resolved here
export function isSafeOutboundUrl(raw: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
	// one trailing dot is the same name to a resolver, so it must not slip past the checks
	const host = parsed.hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '');
	if (!host) return false;
	if (host === 'localhost' || host.endsWith('.localhost')) return false;
	// names that only resolve inside a network
	if (/\.(local|internal|intranet|corp|lan|home\.arpa)$/.test(host)) return false;
	if (host === '0.0.0.0' || host === '::' || host === '::1') return false;
	// ipv6 unique-local fc00::/7 and link-local fe80::/10
	if (/^f[cd][0-9a-f]*:/.test(host) || /^fe[89ab][0-9a-f]*:/.test(host)) return false;
	// ipv4-mapped and nat64 reach private v4 through a v6 host, past the dotted-quad checks
	if (/^::ffff:/i.test(host) || /^64:ff9b:/i.test(host)) return false;

	const dottedQuad = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (dottedQuad) {
		const [firstOctet, secondOctet] = [Number(dottedQuad[1]), Number(dottedQuad[2])];
		if ([firstOctet, secondOctet].some((octet) => octet > 255)) return false;
		if (firstOctet === 0 || firstOctet === 127 || firstOctet === 10) return false;
		// link-local, including cloud metadata
		if (firstOctet === 169 && secondOctet === 254) return false;
		if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return false;
		if (firstOctet === 192 && secondOctet === 168) return false;
		// carrier-grade nat 100.64.0.0/10
		if (firstOctet === 100 && secondOctet >= 64 && secondOctet <= 127) return false;
		// benchmarking 198.18.0.0/15
		if (firstOctet === 198 && (secondOctet === 18 || secondOctet === 19)) return false;
		// multicast 224.0.0.0/4 and reserved 240.0.0.0/4
		if (firstOctet >= 224) return false;
	}
	return true;
}

// drops the path and query, where webhook urls embed their tokens
export function originOf(raw: string): string {
	try {
		return new URL(raw).origin;
	} catch {
		return '';
	}
}

// the x-ari-signature value ari-webhooks sends and receivers recompute
export function signDelivery(
	secret: string,
	timestampSeconds: number,
	deliveryId: string,
	body: string
): string {
	return createHmac('sha256', secret)
		.update(`${timestampSeconds}.${deliveryId}.${body}`)
		.digest('hex');
}
