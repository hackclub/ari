import { describe, expect, test } from 'bun:test';
import { renderReadme } from './readme';

const source = { repoUrl: 'https://github.com/org1/project1', ref: 'main' };

describe('renderReadme', () => {
	test('a quote inside a mailto destination never becomes an attribute', () => {
		const link = renderReadme('[mail](mailto:a"onerror="alert(1))', source);
		expect(link).not.toContain('onerror=');
		expect(link).not.toContain('<a');
		expect(link).toContain('mail');

		const image = renderReadme('![x](mailto:a"onerror="alert(1))', source);
		expect(image).not.toContain('onerror=');
		expect(image).not.toContain('<img');
		expect(image).toBe('<p>x</p>');
	});

	test('a clean mailto link is kept', () => {
		expect(renderReadme('[mail](mailto:user1@example.com)', source)).toContain(
			'<a href="mailto:user1@example.com" target="_blank" rel="noreferrer noopener">mail</a>'
		);
	});

	test('a quote inside an https destination is rejected', () => {
		const html = renderReadme(
			'[x](https://example.com/a"onmouseover="alert(1)) ![y](https://example.com/b"onerror="alert(1).png)',
			source
		);
		expect(html).not.toContain('onmouseover=');
		expect(html).not.toContain('onerror=');
		expect(html).not.toContain('<a');
		expect(html).not.toContain('<img');
	});

	test('javascript and data destinations are dropped', () => {
		for (const markdown of [
			'[x](javascript:alert(1))',
			'[x](JavaScript:alert(1))',
			'![x](data:image/svg+xml,%3Csvg%3E)',
			'[x](vbscript:msgbox)',
			'[x](//evil.example.com/x)',
			'<img src="javascript:alert(1)">',
			'<img src="data:image/png;base64,AAAA">'
		]) {
			const html = renderReadme(markdown, source);
			expect(html).not.toContain('<a');
			expect(html).not.toContain('<img');
			expect(html).not.toContain('javascript:');
			expect(html).not.toContain('data:');
		}
	});

	test('emitted urls are attribute-escaped', () => {
		const html = renderReadme('[x](https://example.com/?a=1&b=2)', source);
		expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
		expect(html).not.toContain('&b=');
	});

	test('relative paths resolve against the repository', () => {
		const html = renderReadme('![shot](./docs/shot.png) [guide](docs/guide.md)', source);
		expect(html).toContain(
			'<img src="https://raw.githubusercontent.com/org1/project1/main/docs/shot.png" alt="shot"'
		);
		expect(html).toContain('href="https://github.com/org1/project1/blob/main/docs/guide.md"');
	});

	test('a relative path that smuggles a quote is encoded, not emitted raw', () => {
		const html = renderReadme('![x](docs/a"onerror="alert(1).png)', source);
		expect(html).toMatch(/^<p><img src="[^"]*%22onerror=%22[^"]*" alt="x"/);
		expect(html).not.toMatch(/<img[^>]* onerror=/);
	});

	test('relative paths without a known host are dropped', () => {
		const html = renderReadme('![x](shot.png)', { repoUrl: 'https://example.com/org1/project1' });
		expect(html).toBe('<p>x</p>');
	});

	test('raw html is reduced to safe images', () => {
		const good = renderReadme(
			'<p align="center"><img src="https://example.com/badge.svg" onerror="alert(1)"></p>',
			source
		);
		expect(good).toContain(
			'<img src="https://example.com/badge.svg" alt="" loading="lazy" referrerpolicy="no-referrer" />'
		);
		expect(good).not.toContain('onerror');
		expect(good).not.toContain('<p align');

		const quoted = renderReadme('<img src="https://example.com/a&quot;x.png">', source);
		expect(quoted).not.toContain('"x.png');

		const relative = renderReadme('<img src="assets/logo.png">', source);
		expect(relative).toContain(
			'src="https://raw.githubusercontent.com/org1/project1/main/assets/logo.png"'
		);

		const notImage = renderReadme('<img src="https://example.com/page">', source);
		expect(notImage).toBe('');
		expect(renderReadme('<script>alert(1)</script>', source)).not.toContain('<script');
	});

	test('text, alt and code are escaped', () => {
		const html = renderReadme(
			'# 1 < 2\n\n![<alt>"](https://example.com/a.png)\n\n```js\n<x>\n```',
			source
		);
		expect(html).toContain('<h2>1 &lt; 2</h2>');
		expect(renderReadme('# <b>title</b>', source)).toBe('<h2>title</h2>');
		expect(html).toContain('alt="&lt;alt&gt;&quot;"');
		expect(html).toContain('<pre><code class="language-js">&lt;x&gt;</code></pre>');
	});

	test('tables only accept known alignments', () => {
		const html = renderReadme('| a | b |\n|:--|--:|\n| 1 | 2 |', source);
		expect(html).toContain('<th style="text-align:left">a</th>');
		expect(html).toContain('<th style="text-align:right">b</th>');
	});
});
