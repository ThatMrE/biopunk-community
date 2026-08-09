import { createServer } from 'node:http';
import { handle } from './src/app.js';
import { getDb, closeDb } from './src/db.js';
import { purgeExpiredSessions } from './src/auth.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

getDb(); // open the database (and run migrations) before accepting traffic

const server = createServer((req, res) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (!req.url.startsWith('/static/')) {
      console.log(`${req.method} ${req.url} ${res.statusCode} ${ms.toFixed(1)}ms`);
    }
  });
  handle(req, res).catch((err) => {
    console.error('unhandled', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ▲ BIOPUNK//NEWS listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\n`);
});

const sessionSweep = setInterval(purgeExpiredSessions, 60 * 60 * 1000);
sessionSweep.unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} — closing down.`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
