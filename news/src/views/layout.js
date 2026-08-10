import { raw, esc } from '../util.js';

export const SITE_NAME = 'Biopunk News';
export const TAGLINE = 'The revolution will not be peer reviewed.';

const TABS = [
  { href: '/', label: 'front', match: (p) => p === '/' || p === '/news' },
  { href: '/newest', label: 'new', match: (p) => p === '/newest' },
  { href: '/best', label: 'best', match: (p) => p === '/best' },
  { href: '/ask', label: 'ask', match: (p) => p === '/ask' },
  { href: '/show', label: 'show', match: (p) => p === '/show' },
  { href: '/comments', label: 'threads', match: (p) => p === '/comments' },
  { href: '/topics', label: 'topics', match: (p) => p === '/topics' || p === '/topic' },
  { href: '/submit', label: 'submit', match: (p) => p === '/submit' },
];

const HELIX = raw(`<svg class="helix" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <g stroke="#b4ff00" stroke-width="1.7" stroke-linecap="round">
    <path d="M6 1c0 5 12 6 12 11s-12 6-12 11" /><path d="M18 1c0 5-12 6-12 11s12 6 12 11" />
  </g>
  <g stroke="#b4ff00" stroke-width="1.2" stroke-linecap="round" opacity=".62">
    <path d="M7.6 4.2h8.8" /><path d="M9.6 8.1h4.8" /><path d="M9.6 15.9h4.8" /><path d="M7.6 19.8h8.8" />
  </g>
</svg>`);

/**
 * Wrap page content in the site chrome.
 *
 * @param {object} ctx  request context: { user, csrf, path }
 * @param {object} opts { title, description, ticker, flash, error, content }
 */
export function layout(ctx, { title, description, ticker = [], flash, error, content }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — biotech, spliced and ranked`;
  const desc =
    description ||
    'Biopunk News — a community-ranked feed of biotech, synthetic biology, gene editing and DIYbio, from the biopunk.community.';

  return raw(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="csrf-token" content="${esc(ctx.csrf || '')}" />
<meta property="og:title" content="${esc(fullTitle)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#0a0a0a" />
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
<link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="/rss" />
<link rel="stylesheet" href="/static/style.css" />
</head>
<body>
${masthead(ctx)}
${tickerBar(ticker)}
<main>
  <div class="wrap">
    ${error ? `<div class="notice error">${esc(error)}</div>` : ''}
    ${flash ? `<div class="notice">${esc(flash)}</div>` : ''}
    ${content}
  </div>
</main>
${footer()}
<script src="/static/app.js" defer></script>
</body>
</html>`);
}

function masthead(ctx) {
  const path = ctx.path || '/';
  const tabs = TABS.map(
    (tab) =>
      `<a href="${tab.href}" class="${tab.match(path) ? 'on' : ''}">${tab.label}</a>`,
  ).join('');

  const me = ctx.user
    ? `<a href="/user?id=${encodeURIComponent(ctx.user.id)}">${esc(ctx.user.id)}</a>
       <span class="karma">(${ctx.user.karma})</span>
       <form method="post" action="/logout" style="display:inline">
         <input type="hidden" name="csrf" value="${esc(ctx.csrf)}" />
         <button class="btn-nav" type="submit">Log out</button>
       </form>`
    : `<a class="btn-nav" href="/login?next=${encodeURIComponent(ctx.fullPath || '/')}">Log in</a>`;

  return `<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/">${HELIX} BIO<b>PUNK</b><span class="slash">//</span>NEWS</a>
    <nav class="tabs">${tabs}</nav>
    <div class="me">${me}</div>
  </div>
</header>`;
}

function tickerBar(entries) {
  if (!entries.length) return '';
  const run = entries.map((e) => `<span>${e}</span>`).join('');
  // Duplicated so the marquee loops without a visible gap.
  return `<div class="ticker" aria-hidden="true"><div class="run">${run}${run}</div></div>`;
}

/** Review deploys run on an ephemeral disk; say so rather than let it surprise. */
const DEMO_NOTICE = process.env.BIOPUNK_DEMO
  ? '<div class="tagline">Demo deploy &mdash; sample content, and the database resets when the server sleeps.</div>'
  : '';

function footer() {
  return `<footer class="foot">
  <div class="wrap">
    <a href="/guidelines">Guidelines</a>
    <a href="/about">About</a>
    <a href="/rss">RSS</a>
    <a href="/api">API</a>
    <a href="/search">Search</a>
    <a href="https://biopunk.community">biopunk.community</a>
    <a href="https://discord.gg/8wtYYtpHNN" rel="noopener" target="_blank">Discord</a>
    <div class="tagline">${esc(TAGLINE)}</div>
    ${DEMO_NOTICE}
  </div>
</footer>`;
}
