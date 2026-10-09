// same-site absolute paths only, so a round-trip through a query param cannot become an open
// redirect. browsers turn `/\evil.com` into a host, so backslashes are refused outright
export function safeReturnPath<Fallback>(
	raw: string | null | undefined,
	fallback: Fallback
): string | Fallback {
	if (!raw || !raw.startsWith('/') || raw.includes('\\')) return fallback;
	for (const character of raw) {
		const code = character.charCodeAt(0);
		if (code < 32 || code === 127) return fallback; // ascii control characters and delete
	}
	let parsed: URL;
	try {
		parsed = new URL(raw, 'http://ari.invalid');
	} catch {
		return fallback;
	}
	if (parsed.origin !== 'http://ari.invalid' || !parsed.pathname.startsWith('/')) return fallback;
	return parsed.pathname + parsed.search + parsed.hash;
}
