import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
	authServerMetadata,
	baseUrl,
	protectedResourceMetadata,
	validRedirectUri,
	verifyPkce
} from './oauth';
import { generateMcpToken, hashMcpToken, mcpTokenPrefix } from './auth';
import { tail4 } from './log';

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
afterAll(() => consoleLog.mockRestore());

const configuredBaseUrl = process.env.BASE_URL;
afterEach(() => {
	if (configuredBaseUrl === undefined) delete process.env.BASE_URL;
	else process.env.BASE_URL = configuredBaseUrl;
});

describe('discovery documents', () => {
	test('protected resource metadata', () => {
		expect(protectedResourceMetadata('https://ari.example.com')).toEqual({
			resource: 'https://ari.example.com/api/mcp',
			authorization_servers: ['https://ari.example.com']
		});
	});

	test('authorization server metadata', () => {
		expect(authServerMetadata('https://ari.example.com')).toEqual({
			issuer: 'https://ari.example.com',
			authorization_endpoint: 'https://ari.example.com/oauth/authorize',
			token_endpoint: 'https://ari.example.com/oauth/token',
			registration_endpoint: 'https://ari.example.com/oauth/register',
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code'],
			code_challenge_methods_supported: ['S256'],
			token_endpoint_auth_methods_supported: ['none'],
			scopes_supported: ['mcp'],
			authorization_response_iss_parameter_supported: true
		});
	});
});

describe('baseUrl', () => {
	test('prefers BASE_URL without trailing slashes', () => {
		process.env.BASE_URL = ' https://ari.example.com// ';
		expect(baseUrl('http://internal:3000')).toBe('https://ari.example.com');
	});

	test('falls back to the request origin when BASE_URL is blank', () => {
		process.env.BASE_URL = '  ';
		expect(baseUrl('http://internal:3000')).toBe('http://internal:3000');
		delete process.env.BASE_URL;
		expect(baseUrl('http://internal:3000')).toBe('http://internal:3000');
	});
});

describe('verifyPkce', () => {
	// the worked example from rfc 7636 appendix b
	const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
	const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

	test('accepts the S256 challenge of the verifier', () => {
		expect(verifyPkce(verifier, challenge)).toBe(true);
	});

	test('rejects a wrong, plain, padded or missing verifier', () => {
		expect(verifyPkce(`${verifier}x`, challenge)).toBe(false);
		expect(verifyPkce(challenge, challenge)).toBe(false);
		expect(verifyPkce(verifier, `${challenge}=`)).toBe(false);
		expect(verifyPkce('', challenge)).toBe(false);
		expect(verifyPkce(verifier, '')).toBe(false);
	});
});

describe('validRedirectUri', () => {
	test('accepts absolute https and loopback http on any port', () => {
		expect(validRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
		expect(validRedirectUri('https://example.com:8443/cb?x=1')).toBe(true);
		expect(validRedirectUri('http://localhost/callback')).toBe(true);
		expect(validRedirectUri('http://localhost:61234/callback')).toBe(true);
		expect(validRedirectUri('http://127.0.0.1:3000/')).toBe(true);
	});

	test('rejects relative, non-https, non-loopback, credentialed and fragment uris', () => {
		expect(validRedirectUri('')).toBe(false);
		expect(validRedirectUri(null)).toBe(false);
		expect(validRedirectUri(42)).toBe(false);
		expect(validRedirectUri('/callback')).toBe(false);
		expect(validRedirectUri('http://example.com/cb')).toBe(false);
		expect(validRedirectUri('http://localhost.evil.com/cb')).toBe(false);
		expect(validRedirectUri('http://[::1]/cb')).toBe(false);
		expect(validRedirectUri('https://user:pass@example.com/cb')).toBe(false);
		expect(validRedirectUri('https://user@example.com/cb')).toBe(false);
		expect(validRedirectUri('https://example.com/cb#frag')).toBe(false);
		expect(validRedirectUri('https://example.com/cb#')).toBe(false);
		expect(validRedirectUri('javascript:alert(1)')).toBe(false);
		expect(validRedirectUri('custom-scheme://callback')).toBe(false);
	});
});

describe('mcp tokens', () => {
	test('a minted token is prefixed and only its sha256 is kept', () => {
		const { raw, hash, last4 } = generateMcpToken();
		expect(raw.startsWith(mcpTokenPrefix)).toBe(true);
		expect(mcpTokenPrefix).toBe('ari_mcp_');
		expect(raw).toHaveLength(51); // 8 prefix chars + 43 base64url chars for 32 bytes
		expect(hash).toBe(createHash('sha256').update(raw).digest('hex'));
		expect(hashMcpToken(raw)).toBe(hash);
		expect(last4).toBe(raw.slice(-4));
		expect(generateMcpToken().raw).not.toBe(raw);
	});

	test('logs only ever show the last four characters', () => {
		expect(tail4('ari_mcp_secretvalue')).toBe('…alue');
		expect(tail4(null)).toBe('(none)');
		expect(tail4('')).toBe('(none)');
	});
});
