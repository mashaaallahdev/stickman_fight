// Lightweight Zero-Dependency Local Static File Server for Dev & Puppeteer Headless Recording
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml'
};

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Route "/" to "/public/index.html"
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/public/index.html';
      if (reqPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      const resolvedPath = path.resolve(path.join(ROOT, reqPath));

      // Security check 1: Path traversal protection
      if (!resolvedPath.startsWith(ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // Security check 2: Block any sensitive dotfiles (.env, .git, etc.)
      const baseName = path.basename(resolvedPath);
      if (baseName.startsWith('.') || reqPath.includes('/.')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // Security check 3: Restrict to public and src directories only
      const relPath = path.relative(ROOT, resolvedPath).replace(/\\/g, '/');
      if (!relPath.startsWith('public/') && !relPath.startsWith('src/')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      const filePath = resolvedPath;

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });

        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(port, () => {
      console.log(`[Server] Live at http://localhost:${port}`);
      resolve(server);
    });
  });
}

// If run directly via node scripts/serve.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(PORT);
}
