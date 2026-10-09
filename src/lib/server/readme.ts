import { marked, type Token, type Tokens } from 'marked';

const safeUrlPattern = /^https?:\/\/[^\s"'<>]+$/i;
const safeMailtoPattern = /^mailto:[^\s"'<>]+$/i;
const imageExtensionPattern = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?\S*)?$/i;

const isAllowedHost = (host: string, domain: string) =>
	host === domain || host.endsWith(`.${domain}`);

const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ReadmeSource {
	repoUrl: string;
	ref?: string;
}

function parseRepoUrl(source: ReadmeSource): URL | null {
	try {
		return new URL(
			source.repoUrl
				.trim()
				.replace(/\.git$/i, '')
				.replace(/\/$/, '')
		);
	} catch {
		return null;
	}
}

function rawBase(source: ReadmeSource): string | null {
	const repoUrl = parseRepoUrl(source);
	if (!repoUrl) return null;
	const segments = repoUrl.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
	if (segments.length < 2) return null;
	const ref = source.ref?.trim() || 'HEAD';
	const host = repoUrl.hostname.toLowerCase();
	if (isAllowedHost(host, 'github.com'))
		return `https://raw.githubusercontent.com/${segments[0]}/${segments[1]}/${ref}/`;
	if (isAllowedHost(host, 'gitlab.com'))
		return `https://gitlab.com/${segments.join('/')}/-/raw/${ref}/`;
	return null;
}

function blobBase(source: ReadmeSource): string | null {
	const repoUrl = parseRepoUrl(source);
	if (!repoUrl) return null;
	const ref = source.ref?.trim() || 'HEAD';
	const host = repoUrl.hostname.toLowerCase();
	if (isAllowedHost(host, 'github.com')) return `${repoUrl.href}/blob/${ref}/`;
	if (isAllowedHost(host, 'gitlab.com')) return `${repoUrl.href}/-/blob/${ref}/`;
	return null;
}

function resolveUrl(href: string, base: string | null): string | null {
	const raw = href.trim();
	if (!raw) return null;
	if (/^mailto:/i.test(raw)) return safeMailtoPattern.test(raw) ? raw : null;
	if (/^https?:/i.test(raw)) return safeUrlPattern.test(raw) ? raw : null;
	if (raw.startsWith('#') || raw.startsWith('//') || raw.includes(':')) return null;
	if (!base) return null;
	try {
		const absolute = new URL(raw.replace(/^\.\//, ''), base).href;
		return safeUrlPattern.test(absolute) ? absolute : null;
	} catch {
		return null;
	}
}

// security: every token is rendered from our own templates with escaped text, raw html is
// reduced to safe images and line breaks, and urls must pass resolveUrl
export function renderReadme(markdown: string, source: ReadmeSource): string {
	const imageBase = rawBase(source);
	const linkBase = blobBase(source);

	const inline = (tokens: Token[] | undefined, fallback = ''): string => {
		if (!tokens?.length) return escapeHtml(fallback);
		return tokens.map(renderInline).join('');
	};

	function renderInline(token: Token): string {
		switch (token.type) {
			case 'text': {
				const text = token as Tokens.Text;
				return text.tokens?.length ? inline(text.tokens) : escapeHtml(text.text);
			}
			case 'escape':
				return escapeHtml((token as Tokens.Escape).text);
			case 'strong':
				return `<strong>${inline((token as Tokens.Strong).tokens)}</strong>`;
			case 'em':
				return `<em>${inline((token as Tokens.Em).tokens)}</em>`;
			case 'del':
				return `<del>${inline((token as Tokens.Del).tokens)}</del>`;
			case 'codespan':
				return `<code>${escapeHtml((token as Tokens.Codespan).text)}</code>`;
			case 'br':
				return '<br />';
			case 'link': {
				const linkToken = token as Tokens.Link;
				const href = resolveUrl(linkToken.href, linkBase);
				const body = inline(linkToken.tokens, linkToken.text);
				return href
					? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${body}</a>`
					: body;
			}
			case 'image': {
				const image = token as Tokens.Image;
				const url = resolveUrl(image.href, imageBase);
				if (!url) return escapeHtml(image.text ?? '');
				return `<img src="${escapeHtml(url)}" alt="${escapeHtml(image.text ?? '')}" loading="lazy" referrerpolicy="no-referrer" />`;
			}
			case 'html':
				return htmlFallback((token as Tokens.HTML).raw);
			default:
				return escapeHtml(
					(token as { raw?: string; text?: string }).text ?? (token as { raw?: string }).raw ?? ''
				);
		}
	}

	function htmlFallback(raw: string): string {
		const images = [...raw.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)];
		let html = '';
		for (const match of images) {
			const url = resolveUrl(match[1], imageBase);
			if (url && (imageExtensionPattern.test(url) || /badge|shields\.io|img\.shields/i.test(url)))
				html += `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
		}
		if (/<br\s*\/?>/i.test(raw)) html += '<br />';
		return html;
	}

	function renderBlock(token: Token): string {
		switch (token.type) {
			case 'space':
				return '';
			case 'heading': {
				const heading = token as Tokens.Heading;
				// shifted down one level so the readme's h1 sits under the page title, html stops at h6
				const level = Math.min(6, Math.max(1, heading.depth + 1));
				return `<h${level}>${inline(heading.tokens, heading.text)}</h${level}>`;
			}
			case 'paragraph': {
				const paragraph = token as Tokens.Paragraph;
				const body = inline(paragraph.tokens, paragraph.text);
				return body.trim() ? `<p>${body}</p>` : '';
			}
			case 'text': {
				const text = token as Tokens.Text;
				return text.tokens?.length ? inline(text.tokens) : escapeHtml(text.text);
			}
			case 'code': {
				const code = token as Tokens.Code;
				const language = (code.lang ?? '').match(/^[\w+-]+/)?.[0]?.toLowerCase();
				return `<pre><code${language ? ` class="language-${language}"` : ''}>${escapeHtml(code.text)}</code></pre>`;
			}
			case 'blockquote':
				return `<blockquote>${(token as Tokens.Blockquote).tokens.map(renderBlock).join('')}</blockquote>`;
			case 'hr':
				return '<hr />';
			case 'list': {
				const list = token as Tokens.List;
				const tag = list.ordered ? 'ol' : 'ul';
				const startAttribute =
					list.ordered && Number(list.start) > 1 ? ` start="${Number(list.start)}"` : '';
				const items = list.items
					.map((item) => {
						const body = item.tokens.map(renderBlock).join('');
						const box = item.task
							? `<span class="md-task${item.checked ? ' on' : ''}" aria-hidden="true"></span> `
							: '';
						return `<li${item.task ? ' class="md-task-item"' : ''}>${box}${body}</li>`;
					})
					.join('');
				return `<${tag}${startAttribute}>${items}</${tag}>`;
			}
			case 'table': {
				const table = token as Tokens.Table;
				const align = (column: number) => {
					const value = table.align?.[column];
					return value === 'left' || value === 'center' || value === 'right'
						? ` style="text-align:${value}"`
						: '';
				};
				const head = table.header
					.map((cell, column) => `<th${align(column)}>${inline(cell.tokens, cell.text)}</th>`)
					.join('');
				const body = table.rows
					.map(
						(row) =>
							`<tr>${row.map((cell, column) => `<td${align(column)}>${inline(cell.tokens, cell.text)}</td>`).join('')}</tr>`
					)
					.join('');
				return `<div class="md-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
			}
			case 'html':
				return htmlFallback((token as Tokens.HTML).raw);
			default:
				return '';
		}
	}

	const tokens = marked.lexer(markdown, { gfm: true, breaks: false });
	return tokens.map(renderBlock).join('');
}
