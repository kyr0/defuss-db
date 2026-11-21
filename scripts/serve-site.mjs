// Serves the generated site in docs/ on 127.0.0.1 for `make start`, `make dev` and the browser e2e. node:http with a
// realpath check keeps the dev server dependency-free; requests outside docs/ get 404. Logs are ISO-8601 lines.
// VERIFIED: without the error handler, EADDRINUSE ended the process with exit code 0 and no output (probe 2026-11-19).
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const log = (level, message, fields = {}) =>
  console.log(
    [
      new Date().toISOString(),
      level,
      message,
      ...Object.entries(fields).map(([k, v]) => k + '=' + v),
    ].join(' '),
  );
const port = Number(process.env.PORT || 4380);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  log('ERROR', 'invalid PORT', { value: JSON.stringify(process.env.PORT) });
  process.exit(2);
}
const root = await realpath('docs');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.tgz': 'application/gzip',
  '.ts': 'text/plain; charset=utf-8',
};
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await realpath(
      resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname)),
    );
    if (!file.startsWith(root + sep)) throw Error('outside document root');
    const info = await stat(file);
    if (!info.isFile()) throw Error('not a file');
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
  } catch {
    log('WARN', 'not found', { path: JSON.stringify(req.url) });
    res.writeHead(404).end();
  }
});
server.on('error', (error) => {
  log('ERROR', 'server failed', { code: error.code, port });
  process.exit(1);
});
server.listen(port, '127.0.0.1', () =>
  log('INFO', 'serving docs', { url: 'http://127.0.0.1:' + server.address().port }),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => {
    log('INFO', 'stopping', { signal });
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
