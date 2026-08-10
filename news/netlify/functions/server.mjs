/**
 * Netlify adapter for the Biopunk News server.
 *
 * The app is an ordinary `node:http` handler, so this file is just a shim
 * between Netlify's web-standard Request/Response and the Node req/res pair
 * the app expects. Plain JS rather than TypeScript to match the rest of the
 * project, which has no build step and no dependencies.
 *
 * Caveat worth knowing: serverless containers have an ephemeral filesystem, so
 * the SQLite file lives in /tmp and is re-seeded whenever a cold container
 * starts. Good enough to review the site; not a home for real data.
 */
import { Readable } from 'node:stream';

let ready = null;

/** Open the database and seed it once per container. */
async function boot() {
  if (ready) return ready;
  ready = (async () => {
    process.env.BIOPUNK_DB ||= '/tmp/biopunk-news.db';
    process.env.BIOPUNK_DEMO ||= '1';
    const { getDb } = await import('../../src/db.js');
    const { seed } = await import('../../src/seed.js');
    const db = getDb();
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
      seed();
    }
    const { handle } = await import('../../src/app.js');
    return handle;
  })();
  return ready;
}

/** Minimal ServerResponse stand-in that collects the reply. */
class ResponseCollector {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.headersSent = false;
    this.chunks = [];
    this.finished = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  }

  getHeader(name) {
    return this.headers[String(name).toLowerCase()];
  }

  removeHeader(name) {
    delete this.headers[String(name).toLowerCase()];
  }

  writeHead(status, headers) {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers || {})) this.setHeader(name, value);
    this.headersSent = true;
    return this;
  }

  write(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    return true;
  }

  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    this.resolve();
    return this;
  }

  /* The app only registers a 'finish' listener in server.js, but keep the
     EventEmitter surface harmless in case that changes. */
  on() { return this; }
  once() { return this; }
  emit() { return true; }
}

export default async function netlifyHandler(request, context) {
  const handle = await boot();

  const url = new URL(request.url);
  const body = ['GET', 'HEAD'].includes(request.method)
    ? null
    : Buffer.from(await request.arrayBuffer());

  const req = Readable.from(body && body.length ? [body] : []);
  req.method = request.method;
  req.url = url.pathname + url.search;
  req.headers = Object.fromEntries(request.headers);
  req.socket = { remoteAddress: context?.ip || request.headers.get('x-nf-client-connection-ip') || '0.0.0.0' };

  const res = new ResponseCollector();
  await handle(req, res);
  await res.finished;

  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, String(v));
    else headers.set(name, String(value));
  }
  // The byte count came from the Node response; let the platform recompute it.
  headers.delete('content-length');

  return new Response(res.chunks.length ? Buffer.concat(res.chunks) : null, {
    status: res.statusCode,
    headers,
  });
}

export const config = {
  path: '/*',
  // Static assets under /static/* are served from the CDN, not through here.
  excludedPath: '/static/*',
  preferStatic: true,
};
