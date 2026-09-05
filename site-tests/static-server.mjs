import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '../dist/site');
const port = Number(process.env.PORT || 4173);
const staticConfig = JSON.parse(readFileSync(resolve(root, 'staticwebapp.config.json'), 'utf8'));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ps1': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

function fileFor(pathname) {
  const requestPath = decodeURIComponent(pathname);
  const candidate = resolve(root, `.${requestPath === '/' ? '/index.html' : requestPath}`);
  if (!candidate.startsWith(`${root}/`) && candidate !== root) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = resolve(candidate, 'index.html');
    if (existsSync(index)) return index;
  }
  return null;
}

function headerFor(pathname, name) {
  const route = staticConfig.routes?.find((entry) => {
    const pattern = entry.route || '';
    return pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern;
  });
  return route?.headers?.[name] || null;
}

createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const file = fileFor(pathname);
  const missing = !file;
  const target = file || resolve(root, '404/index.html');
  response.statusCode = missing ? 404 : 200;
  response.setHeader('Content-Type', contentTypes[extname(target)] || 'application/octet-stream');
  response.setHeader('Cache-Control', headerFor(pathname, 'Cache-Control') || 'public, max-age=30');
  if (request.method === 'HEAD') return response.end();
  createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1');
