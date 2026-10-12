const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '127.0.0.1'; // local development only; not reachable from other machines
const ROOT = __dirname;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.c': 'text/plain',
  '.cpp': 'text/plain',
  '.txt': 'text/plain',
  '.csv': 'text/plain',
  '.shrink': 'application/octet-stream',
  '.sb': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendText(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
  res.end(message);
}

const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(reqUrl);
  } catch {
    sendText(res, 400, '400 Bad Request');
    return;
  }

  // Never serve dotfiles or dot-folders such as .git/ or .gitignore
  if (decodedUrl.split(/[\\/]/).some(segment => segment.startsWith('.'))) {
    sendText(res, 404, '404 Not Found');
    return;
  }

  const filePath = path.resolve(ROOT, '.' + (decodedUrl === '/' ? '/index.html' : decodedUrl));

  // Only serve files inside the project folder (blocks ../ path traversal)
  if (!filePath.startsWith(ROOT + path.sep)) {
    sendText(res, 403, '403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, '404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ShrinkByte Dev Server running at http://localhost:${PORT}`);
});
