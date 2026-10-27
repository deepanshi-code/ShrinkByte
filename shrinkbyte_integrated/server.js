const http = require('http');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '127.0.0.1'; // local development only; not reachable from other machines
const ROOT = path.join(__dirname, 'frontend');   // static site (index.html, app.js, ...)
const BACKEND_DIR = path.join(__dirname, 'backend'); // C++ Huffman engine, untouched
const BIN_NAME = process.platform === 'win32' ? 'shrinkbyte.exe' : 'shrinkbyte';
const BIN_PATH = path.join(BACKEND_DIR, BIN_NAME);
const MAX_BYTES = 1024 * 1024 * 1024; // same 1 GB limit as the UI
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


// ---------------------------------------------------------------------------
// C++ backend bridge: POST /api/compress and /api/decompress run the real
// shrinkbyte binary (compress <in> <out> / decompress <in> <out>).
// ---------------------------------------------------------------------------
function buildBackend() {
  if (fs.existsSync(BIN_PATH)) return true;
  const sources = ['main1.cpp', 'HuffmanEncodercpp1.cpp', 'minheap.cpp', 'frequency.cpp'];
  try {
    // Same command as backend/build.txt
    execFileSync('g++', ['-std=c++11', '-O2', '-DUSE_DARSH_TREE', ...sources, '-o', BIN_NAME], { cwd: BACKEND_DIR, stdio: 'pipe' });
    console.log('Built C++ backend: ' + BIN_PATH);
    return true;
  } catch (e) {
    console.warn('Could not build the C++ backend (is g++ installed?). The browser codec will be used instead.');
    return false;
  }
}

function runBinary(args) {
  return new Promise(resolve => {
    execFile(BIN_PATH, args, { timeout: 10 * 60 * 1000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}

async function handleApi(req, res, action) {
  if (req.method !== 'POST') return sendText(res, 405, '405 Method Not Allowed');
  if (!backendReady) return sendJson(res, 503, { status: 'BACKEND_UNAVAILABLE', message: 'C++ backend is not built' });

  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BYTES) return sendJson(res, 413, { status: 'TOO_LARGE', message: 'File is larger than the 1 GB limit' });

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shrinkbyte-'));
  const inPath = path.join(dir, 'input.bin');
  const outPath = path.join(dir, 'output.bin');
  try {
    await pipeline(req, fs.createWriteStream(inPath));

    const run = await runBinary([action, inPath, outPath]);
    if (!run.ok) {
      const m = /Error:\s*(.*)/.exec(run.stderr);
      return sendJson(res, 422, { status: 'CODEC_ERROR', message: m ? m[1].trim() : 'The C++ engine failed' });
    }
    if (!fs.existsSync(outPath)) {
      // The engine exits 0 without writing when compression would not shrink the file
      return sendJson(res, 409, { status: 'NOT_COMPRESSIBLE', message: run.stdout.trim() || "File can't be compressed further down. Original file will be used as it is." });
    }

    const headers = { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(outPath).size, 'X-Content-Type-Options': 'nosniff' };
    if (action === 'compress') {
      // Round-trip check using the same C++ binary
      const backPath = path.join(dir, 'back.bin');
      const back = await runBinary(['decompress', outPath, backPath]);
      const same = back.ok && fs.existsSync(backPath) && fs.readFileSync(backPath).equals(fs.readFileSync(inPath));
      if (!same) return sendJson(res, 500, { status: 'CORRUPT_DATA', message: 'Round-trip check failed' });
      const head = Buffer.alloc(14);
      const fd = fs.openSync(outPath, 'r'); fs.readSync(fd, head, 0, 14, 0); fs.closeSync(fd);
      headers['X-Verified'] = 'true';
      headers['X-Distinct-Bytes'] = String(head.readUInt16LE(12));
    } else {
      const head = Buffer.alloc(14);
      const fd = fs.openSync(inPath, 'r'); fs.readSync(fd, head, 0, 14, 0); fs.closeSync(fd);
      headers['X-Distinct-Bytes'] = String(head.readUInt16LE(12));
    }
    res.writeHead(200, headers);
    await pipeline(fs.createReadStream(outPath), res);
  } catch (e) {
    if (!res.headersSent) sendJson(res, 500, { status: 'UNKNOWN', message: 'Server error while processing the file' });
    else res.destroy();
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const backendReady = buildBackend();

const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];

  if (reqUrl === '/api/compress') { handleApi(req, res, 'compress'); return; }
  if (reqUrl === '/api/decompress') { handleApi(req, res, 'decompress'); return; }

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
  console.log(backendReady ? 'Engine: C++ backend' : 'Engine: browser (JS) codec only');
});
