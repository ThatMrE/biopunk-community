import { html, raw, esc, formatText, timeAgo, plural } from '../util.js';
import { TOPICS, topicLabel, PAGE_SIZE } from '../models.js';
import { feed, pager, commentNode, commentForm, storyRow, topicNav, relTime } from './components.js';

/* ------------------------------------------------------------- listings */

export function listingPage(ctx, { heading, blurb, items, page, total, basePath, voted, topic = null, showTopics = false }) {
  return html`
    <div class="page-head">
      <h1>${heading}</h1>
      ${blurb ? html`<p>${blurb}</p>` : ''}
    </div>
    ${showTopics ? topicNav(topic) : ''}
    ${feed(ctx, items, { startRank: (page - 1) * PAGE_SIZE + 1, voted })}
    ${pager(basePath, page, total, PAGE_SIZE)}
  `;
}

export function commentsFeedPage(ctx, { items, page, total, heading, blurb, basePath, voted }) {
  return html`
    <div class="page-head">
      <h1>${heading}</h1>
      ${blurb ? html`<p>${blurb}</p>` : ''}
    </div>
    ${items.length === 0
      ? html`<div class="empty">// nothing transmitted yet</div>`
      : html`<div class="thread" style="border-top:0;padding-top:0">
          ${items.map((c) =>
            commentNode(ctx, { ...c, depth: 0 }, { voted: voted.has(c.id), indentPx: 0 }),
          )}
        </div>`}
    ${pager(basePath, page, total, PAGE_SIZE)}
  `;
}

/* ------------------------------------------------------------ item page */

export function itemPage(ctx, { story, comments, voted, opId, breadcrumb = [] }) {
  return html`
    ${breadcrumb.length
      ? html`<div class="mono" style="color:var(--muted);margin-bottom:12px">
          ${breadcrumb.map((b) => html`<a href="/item?id=${b.id}">${b.label}</a> <span class="sep">/</span> `)}
        </div>`
      : ''}
    <ol class="feed">${storyRow(ctx, story, { rank: null, voted: voted.has(story.id), showText: true })}</ol>
    ${commentForm(ctx, story.id)}
    <div class="thread">
      <div class="mono" style="color:var(--muted);margin-bottom:12px">
        ${plural(comments.length, 'comment')} in thread
      </div>
      ${comments.length === 0
        ? html`<div class="empty">// no replies. be the first strand.</div>`
        : comments.map((c) => commentNode(ctx, c, { voted: voted.has(c.id), opId }))}
    </div>
  `;
}

/** Permalink view of a single comment plus its subtree. */
export function commentPermalinkPage(ctx, { comment, story, replies, voted, opId }) {
  return html`
    <div class="page-head">
      <h1>Comment</h1>
      <p>on <a href="/item?id=${story.id}">${story.title}</a></p>
    </div>
    <div class="thread" style="border-top:0;padding-top:0">
      ${commentNode(ctx, { ...comment, depth: 0 }, { voted: voted.has(comment.id), opId, indentPx: 0 })}
      ${replies.map((r) =>
        commentNode(ctx, { ...r, depth: r.depth - comment.depth }, { voted: voted.has(r.id), opId }),
      )}
    </div>
    ${commentForm(ctx, comment.id, { label: 'Reply' })}
  `;
}

export function replyPage(ctx, { parent, story }) {
  return html`
    <div class="page-head">
      <h1>Reply</h1>
      <p>to ${parent.by} on <a href="/item?id=${story.id}">${story.title}</a></p>
    </div>
    <div class="thread" style="border-top:0;padding-top:0">
      ${commentNode(ctx, { ...parent, depth: 0 }, { indentPx: 0 })}
    </div>
    ${commentForm(ctx, parent.id, { label: 'Your reply', autofocus: true })}
  `;
}

/* ---------------------------------------------------------------- forms */

export function submitPage(ctx, { values = {}, error = null } = {}) {
  return html`
    <div class="page-head">
      <h1>Submit</h1>
      <p>Papers, preprints, protocols, teardowns, builds, policy. Link or text — not both.</p>
    </div>
    ${error ? html`<div class="notice error">${error}</div>` : ''}
    <form class="stack" method="post" action="/submit">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <div class="field">
        <label for="title">Title</label>
        <input id="title" name="title" type="text" maxlength="120" required
               value="${values.title || ''}" placeholder="What happened, in plain language" />
        <div class="hint">Prefix with "Ask BN:" or "Show BN:" to file it under those channels.</div>
      </div>
      <div class="field">
        <label for="url">URL</label>
        <input id="url" name="url" type="text" value="${values.url || ''}"
               placeholder="https://www.biorxiv.org/content/..." />
      </div>
      <div class="field">
        <label for="topic">Channel</label>
        <select id="topic" name="topic">
          <option value="">— pick a channel —</option>
          ${TOPICS.map(
            (t) => html`<option value="${t.slug}" ${values.topic === t.slug ? raw('selected') : ''}>${t.label}</option>`,
          )}
        </select>
      </div>
      <div class="field">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="7"
                  placeholder="// leave the URL blank and write here for an Ask BN or a discussion">${values.text || ''}</textarea>
      </div>
      <button class="btn solid" type="submit">Splice it in</button>
    </form>
  `;
}

export function editPage(ctx, { item, error = null }) {
  const isStory = item.type === 'story';
  return html`
    <div class="page-head">
      <h1>Edit ${isStory ? 'submission' : 'comment'}</h1>
      <p>Edits are open for two hours after posting.</p>
    </div>
    ${error ? html`<div class="notice error">${error}</div>` : ''}
    <form class="stack" method="post" action="/edit">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <input type="hidden" name="id" value="${item.id}" />
      ${isStory
        ? html`<div class="field">
              <label for="title">Title</label>
              <input id="title" name="title" type="text" maxlength="120" required value="${item.title}" />
            </div>
            <div class="field">
              <label for="topic">Channel</label>
              <select id="topic" name="topic">
                <option value="">— none —</option>
                ${TOPICS.map(
                  (t) => html`<option value="${t.slug}" ${item.topic === t.slug ? raw('selected') : ''}>${t.label}</option>`,
                )}
              </select>
            </div>`
        : ''}
      <div class="field">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="8">${item.text || ''}</textarea>
      </div>
      <div class="more" style="margin-top:0">
        <button class="btn solid" type="submit">Save</button>
        <a class="btn ghost" href="/item?id=${isStory ? item.id : item.story_id}">Cancel</a>
      </div>
    </form>
    <form method="post" action="/delete" style="margin-top:28px">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <input type="hidden" name="id" value="${item.id}" />
      <button class="btn ghost small" type="submit"
              onclick="return confirm('Delete this permanently?')">Delete</button>
    </form>
  `;
}

export function loginPage(ctx, { error = null, next = '/', mode = 'login', values = {} } = {}) {
  const signupError = mode === 'signup' ? error : null;
  const loginError = mode === 'login' ? error : null;
  return html`
    <div class="page-head">
      <h1>Access</h1>
      <p>One handle, one passphrase. No email required — we do not want it.</p>
    </div>

    ${loginError ? html`<div class="notice error">${loginError}</div>` : ''}
    <form class="stack" method="post" action="/login">
      <input type="hidden" name="next" value="${next}" />
      <input type="hidden" name="mode" value="login" />
      <div class="field">
        <label for="lid">Handle</label>
        <input id="lid" name="id" type="text" autocomplete="username" required
               value="${mode === 'login' ? values.id || '' : ''}" />
      </div>
      <div class="field">
        <label for="lpw">Passphrase</label>
        <input id="lpw" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn solid" type="submit">Log in</button>
    </form>

    <div class="page-head" style="margin-top:44px">
      <h1>Or culture a new handle</h1>
    </div>
    ${signupError ? html`<div class="notice error">${signupError}</div>` : ''}
    <form class="stack" method="post" action="/login">
      <input type="hidden" name="next" value="${next}" />
      <input type="hidden" name="mode" value="signup" />
      <div class="field">
        <label for="sid">Handle</label>
        <input id="sid" name="id" type="text" autocomplete="username" required maxlength="20"
               value="${mode === 'signup' ? values.id || '' : ''}" />
        <div class="hint">2-20 chars: letters, numbers, - and _</div>
      </div>
      <div class="field">
        <label for="spw">Passphrase</label>
        <input id="spw" name="password" type="password" autocomplete="new-password" required minlength="8" />
        <div class="hint">8 characters minimum. Stored as a scrypt hash, never in the clear.</div>
      </div>
      <button class="btn ghost" type="submit">Create handle</button>
    </form>
  `;
}

/* ---------------------------------------------------------------- users */

export function userPage(ctx, { profile, stats, isSelf, saved = false }) {
  return html`
    <div class="page-head">
      <h1>${profile.id}</h1>
      <p>Cultured ${timeAgo(profile.created_at)}</p>
    </div>
    ${saved ? html`<div class="notice">Profile updated.</div>` : ''}
    <dl class="profile">
      <dt>Karma</dt><dd>${profile.karma}</dd>
      <dt>Submissions</dt><dd><a href="/submitted?id=${profile.id}">${stats.stories || 0}</a></dd>
      <dt>Comments</dt><dd><a href="/threads?id=${profile.id}">${stats.comments || 0}</a></dd>
      <dt>About</dt><dd>${profile.about ? formatText(profile.about) : html`<span style="color:var(--muted)">—</span>`}</dd>
      ${isSelf ? html`<dt>Favorites</dt><dd><a href="/favorites">saved items</a></dd>` : ''}
    </dl>
    ${isSelf
      ? html`<form class="stack" method="post" action="/user" style="margin-top:30px">
          <input type="hidden" name="csrf" value="${ctx.csrf}" />
          <div class="field">
            <label for="about">About</label>
            <textarea id="about" name="about" rows="5"
              placeholder="// lab, focus, what you are building">${profile.about || ''}</textarea>
          </div>
          <button class="btn solid" type="submit">Save</button>
        </form>`
      : ''}
  `;
}

/* --------------------------------------------------------------- search */

export function searchPage(ctx, { query, items, page, total, voted }) {
  return html`
    <div class="page-head">
      <h1>Search</h1>
      <p>Titles, text and domains across every channel.</p>
    </div>
    <form class="searchbar" method="get" action="/search">
      <input type="search" name="q" value="${query || ''}" placeholder="crispr, organoid, biorxiv.org…" autofocus />
      <button class="btn solid" type="submit">Run</button>
    </form>
    ${query
      ? html`<div class="statstrip"><span><b>${total}</b> results for "${query}"</span></div>
          ${items.length
            ? html`<ol class="feed">
                ${items.map((item) =>
                  item.type === 'story'
                    ? storyRow(ctx, item, { voted: voted.has(item.id) })
                    : html`<li class="story">
                        <span class="rank"></span><span></span>
                        <span class="title-line">
                          <a class="title" href="/item?id=${item.id}">comment by ${item.by}</a>
                        </span>
                        <span class="subline">${relTime(item.created_at)}</span>
                        <div class="text-body">${formatText((item.text || '').slice(0, 300))}</div>
                      </li>`,
                )}
              </ol>`
            : html`<div class="empty">// no matching sequences</div>`}
          ${pager(`/search?q=${encodeURIComponent(query)}`, page, total, PAGE_SIZE)}`
      : ''}
  `;
}

export function topicsPage(ctx, { counts }) {
  return html`
    <div class="page-head">
      <h1>Channels</h1>
      <p>The feed, split by wetware discipline.</p>
    </div>
    <ol class="feed">
      ${TOPICS.map(
        (t) => html`<li class="story">
          <span class="rank"></span>
          <span></span>
          <span class="title-line"><a class="title" href="/topic?t=${t.slug}">${t.label}</a></span>
          <span class="subline">${plural(counts[t.slug] || 0, 'submission')}</span>
        </li>`,
      )}
    </ol>
  `;
}

/* --------------------------------------------------------------- static */

export function aboutPage(ctx, { stats }) {
  return html`
    <div class="page-head">
      <h1>About</h1>
      <p>Biopunk News is the feed for the open biotech movement.</p>
    </div>
    <div class="statstrip">
      <span><b>${stats.stories}</b> submissions</span>
      <span><b>${stats.comments}</b> comments</span>
      <span><b>${stats.votes}</b> upvotes</span>
      <span><b>${stats.users}</b> handles</span>
    </div>
    <div class="text-body" style="max-width:640px">
      <p>TradBio has reached a dead end: billions spent, decades waited, and the results locked behind
      a paywall or a patent thicket. Biopunk News is the other channel — preprints, protocols, teardowns,
      community lab builds, policy fights and the occasional beautiful failure, ranked by the people
      actually doing the work.</p>
      <p>Anyone can read. Handles can submit, comment and upvote. Ranking is points decaying against
      age, with a nudge for real discussion and a penalty for any one outlet dominating the page —
      so a bioRxiv preprint from a two-person lab can outrank a press release.</p>
      <p>It is part of <a href="https://biopunk.community">biopunk.community</a>, alongside
      <a href="https://biopunk.house">the House</a>, <a href="https://biopunklab.com">the Lab</a>
      and <a href="https://biopunkvc.com">the fund</a>.</p>
      <p>Mission: enable access to experimental science for all.</p>
    </div>
  `;
}

export function guidelinesPage() {
  return html`
    <div class="page-head">
      <h1>Guidelines</h1>
      <p>Short, and enforced by the community.</p>
    </div>
    <div class="text-body" style="max-width:640px">
      <p><b>On topic:</b> biology you can do something with. Preprints, papers, protocols, hardware,
      biosecurity, policy, funding, community labs, and honest write-ups of things that did not work.</p>
      <p><b>Off topic:</b> undisclosed promotion, health misinformation, stock pumping, rage bait,
      and anything that reads as a press release wearing a lab coat.</p>
      <p><b>Titles:</b> use the original title unless it is clickbait or misleading. No editorialising,
      no ALL CAPS, no added exclamation marks.</p>
      <p><b>Comments:</b> respond to the strongest version of the argument. Cite. "Source?" is a fine
      question; sneering is not. Disagreement about data is the point of the site.</p>
      <p><b>Safety:</b> do not post protocols, sequences or acquisition routes for agents that could
      cause mass harm. This is the one rule with no discussion attached — such posts are removed and
      the handle is banned.</p>
      <p><b>Voting:</b> upvote what teaches you something. Voting rings and sockpuppets get the whole
      cluster wiped. Flag rather than argue with spam.</p>
    </div>
  `;
}

export function apiPage() {
  const endpoints = [
    ['GET', '/api/stories', 'Ranked front page. ?page, ?limit, ?topic, ?sort=top|new|best|ask|show'],
    ['GET', '/api/item/:id', 'One story or comment, with its comment tree when it is a story.'],
    ['GET', '/api/user/:id', 'Public profile: karma, about, counts.'],
    ['GET', '/api/search?q=', 'Full listing search.'],
    ['GET', '/api/topics', 'Channels and their submission counts.'],
    ['POST', '/api/vote', '{ id, dir: "up"|"down" } — session cookie + X-CSRF-Token required.'],
    ['POST', '/api/submit', '{ title, url?, text?, topic? } — returns the new item.'],
    ['POST', '/api/comment', '{ parent, text } — returns the new comment.'],
    ['GET', '/rss', 'RSS 2.0 of the current front page.'],
  ];
  return html`
    <div class="page-head">
      <h1>API</h1>
      <p>JSON over the same data the pages render. Read endpoints are open; writes need a session.</p>
    </div>
    <div class="text-body" style="max-width:720px">
      <ol class="feed">
        ${endpoints.map(
          ([method, path, note]) => html`<li class="story">
            <span class="rank mono">${method}</span>
            <span></span>
            <span class="title-line"><code>${path}</code></span>
            <span class="subline">${note}</span>
          </li>`,
        )}
      </ol>
      <p style="margin-top:20px">Rate limit: 60 requests/minute per IP on reads, tighter on writes.
      Be kind — it is one small server in a shared incubator.</p>
    </div>
  `;
}

export function notFoundPage() {
  return html`
    <div class="page-head">
      <h1>404 — sequence not found</h1>
      <p>That page did not survive the transfection.</p>
    </div>
    <div class="more"><a class="btn solid" href="/">Back to the feed</a></div>
  `;
}

export function errorPage(message) {
  return html`
    <div class="page-head">
      <h1>Contamination</h1>
      <p>${message || 'Something broke in the incubator.'}</p>
    </div>
    <div class="more"><a class="btn solid" href="/">Back to the feed</a></div>
  `;
}

export { esc };
