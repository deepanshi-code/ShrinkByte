/**
 * ShrinkByte SB01 codec: Huffman compression and decompression in the browser.
 *
 * This is a JavaScript port of the C++ engine in HuffmanEncodercpp1.cpp. It builds the
 * same tree with the same tie-break rule and writes the same layout, so archives made
 * here are byte-identical to the C++ CLI output, and either side can decompress the other's.
 *
 * SB01 layout (all integers little-endian):
 *   'S' 'B' '0' '1'                    magic (4 bytes)
 *   u64  original size in bytes        (8 bytes)
 *   u16  number of distinct bytes N    (2 bytes)
 *   N x (u8 byte value, u32 count)     frequency table, ascending by byte value
 *   Huffman bitstream                  MSB-first, last byte zero-padded
 *
 * Files are read in chunks, so large inputs never need to fit in one buffer.
 * Works as a classic <script>, inside a Web Worker (importScripts), and in Node (require).
 */
(function (root) {
  'use strict';

  const MAGIC = [0x53, 0x42, 0x30, 0x31]; // "SB01"
  const HEADER_SIZE = 4 + 8 + 2;
  const ENTRY_SIZE = 1 + 4;
  const INT_MAX = 2147483647;
  const CHUNK_SIZE = 4 * 1024 * 1024;
  const MAX_INPUT_BYTES = 1024 * 1024 * 1024; // matches the "Max size 1 GB" limit in the UI
  const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024; // refuse archives that would expand past 1 GB
  const MAX_NODES = 511; // 256 leaves + 255 internal nodes
  const FAST_CODE_BITS = 24; // codes up to this length are written in one step

  // Same statuses and messages as huffmanStatusToString() in the C++ engine
  const Status = {
    INVALID_INPUT: 'INVALID_INPUT',
    FILE_READ_FAILED: 'FILE_READ_FAILED',
    BAD_MAGIC: 'BAD_MAGIC',
    TRUNCATED_DATA: 'TRUNCATED_DATA',
    SIZE_MISMATCH: 'SIZE_MISMATCH',
    CORRUPT_DATA: 'CORRUPT_DATA',
    TOO_LARGE: 'TOO_LARGE',
    CANCELLED: 'CANCELLED'
  };

  const STATUS_MESSAGES = {
    INVALID_INPUT: 'Invalid input',
    FILE_READ_FAILED: 'Could not read file',
    BAD_MAGIC: 'Bad magic: not a ShrinkByte (SB01) file',
    TRUNCATED_DATA: 'Truncated data: file ends too early',
    SIZE_MISMATCH: 'Size mismatch between header and data',
    CORRUPT_DATA: 'Corrupt data',
    TOO_LARGE: 'File is larger than the 1 GB limit',
    CANCELLED: 'Cancelled'
  };

  class SB01Error extends Error {
    constructor(status) {
      super(STATUS_MESSAGES[status] || 'Unknown error');
      this.name = 'SB01Error';
      this.status = status;
    }
  }

  // ------------------------------------------------------------------------
  // Huffman tree (flat arrays: node i has left[i], right[i], symbol[i])
  // ------------------------------------------------------------------------

  // Min-heap ordered by (frequency, id), the same order as CompareNode in the C++ engine.
  // Leaves use their byte value as id; merged nodes get ids 256, 257, ... in creation order.
  class NodeHeap {
    constructor(freq, id) {
      this.items = [];
      this.freq = freq;
      this.id = id;
    }

    less(a, b) {
      if (this.freq[a] !== this.freq[b]) return this.freq[a] < this.freq[b];
      return this.id[a] < this.id[b];
    }

    push(node) {
      const items = this.items;
      items.push(node);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!this.less(items[i], items[parent])) break;
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      }
    }

    pop() {
      const items = this.items;
      const top = items[0];
      const last = items.pop();
      if (items.length > 0) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let smallest = i;
          if (l < items.length && this.less(items[l], items[smallest])) smallest = l;
          if (r < items.length && this.less(items[r], items[smallest])) smallest = r;
          if (smallest === i) break;
          [items[i], items[smallest]] = [items[smallest], items[i]];
          i = smallest;
        }
      }
      return top;
    }

    get size() {
      return this.items.length;
    }
  }

  // counts: array of 256 frequencies. Returns null when every count is zero.
  function buildTree(counts) {
    const left = new Int16Array(MAX_NODES).fill(-1);
    const right = new Int16Array(MAX_NODES).fill(-1);
    const symbol = new Uint8Array(MAX_NODES);
    const freq = new Float64Array(MAX_NODES);
    const id = new Uint16Array(MAX_NODES);
    let nodeCount = 0;

    function newNode(byteValue, frequency, nodeId) {
      const n = nodeCount++;
      symbol[n] = byteValue;
      freq[n] = frequency;
      id[n] = nodeId;
      return n;
    }

    const leaves = [];
    for (let b = 0; b < 256; b++) {
      if (counts[b] > 0) leaves.push(newNode(b, counts[b], b));
    }
    if (leaves.length === 0) return null;

    let rootNode;
    if (leaves.length === 1) {
      // One distinct byte: give it the code "0" by hanging it under a root (same as C++)
      rootNode = newNode(0, freq[leaves[0]], 0);
      left[rootNode] = leaves[0];
    } else {
      const heap = new NodeHeap(freq, id);
      leaves.forEach(n => heap.push(n));
      let nextId = 256;
      while (heap.size > 1) {
        const l = heap.pop();
        const r = heap.pop();
        const parent = newNode(0, freq[l] + freq[r], nextId++);
        left[parent] = l;
        right[parent] = r;
        heap.push(parent);
      }
      rootNode = heap.pop();
    }

    return { root: rootNode, left, right, symbol, distinct: leaves.length };
  }

  function isLeaf(tree, n) {
    return tree.left[n] < 0 && tree.right[n] < 0;
  }

  // Walks the tree: left adds a 0 bit, right adds a 1 bit.
  // Returns per-byte code lengths, plus packed values for short codes and bit arrays for long ones.
  function buildCodes(tree) {
    const length = new Uint8Array(256);
    const value = new Uint32Array(256);
    const bits = new Array(256).fill(null);
    const stack = [[tree.root, []]];
    while (stack.length) {
      const [n, path] = stack.pop();
      if (isLeaf(tree, n)) {
        const code = path.length ? path : [0];
        const s = tree.symbol[n];
        length[s] = code.length;
        bits[s] = code;
        if (code.length <= FAST_CODE_BITS) {
          let v = 0;
          for (const bit of code) v = (v << 1) | bit;
          value[s] = v;
        }
        continue;
      }
      if (tree.right[n] >= 0) stack.push([tree.right[n], path.concat(1)]);
      if (tree.left[n] >= 0) stack.push([tree.left[n], path.concat(0)]);
    }
    return { length, value, bits };
  }

  // ------------------------------------------------------------------------
  // Little-endian helpers
  // ------------------------------------------------------------------------
  function writeHeader(originalSize, counts) {
    const present = [];
    for (let b = 0; b < 256; b++) if (counts[b] > 0) present.push(b);
    const out = new Uint8Array(HEADER_SIZE + present.length * ENTRY_SIZE);
    const view = new DataView(out.buffer);
    out.set(MAGIC, 0);
    view.setBigUint64(4, BigInt(originalSize), true);
    view.setUint16(12, present.length, true);
    let pos = HEADER_SIZE;
    for (const b of present) {
      out[pos] = b;
      view.setUint32(pos + 1, counts[b], true);
      pos += ENTRY_SIZE;
    }
    return out;
  }

  // ------------------------------------------------------------------------
  // Chunked reading and writing
  // ------------------------------------------------------------------------
  function checkCancelled(options) {
    if (options.isCancelled && options.isCancelled()) throw new SB01Error(Status.CANCELLED);
  }

  async function readSlice(blob, start, end) {
    try {
      return new Uint8Array(await blob.slice(start, end).arrayBuffer());
    } catch (err) {
      throw new SB01Error(Status.FILE_READ_FAILED);
    }
  }

  // Collects output bytes into fixed-size chunks and hands each full chunk to onChunk.
  class ChunkWriter {
    constructor(onChunk) {
      this.onChunk = onChunk;
      this.buffer = new Uint8Array(CHUNK_SIZE);
      this.pos = 0;
      this.written = 0;
    }

    async flush() {
      if (this.pos === 0) return;
      const chunk = this.buffer.slice(0, this.pos);
      this.written += this.pos;
      this.pos = 0;
      await this.onChunk(chunk);
    }
  }

  function report(options, phase, done, total) {
    if (options.onProgress) options.onProgress({ phase, done, total });
  }

  // ------------------------------------------------------------------------
  // Compression
  // ------------------------------------------------------------------------
  async function countBytes(blob, options) {
    const counts = new Float64Array(256);
    report(options, 'read', 0, blob.size);
    for (let start = 0; start < blob.size; start += CHUNK_SIZE) {
      checkCancelled(options);
      const bytes = await readSlice(blob, start, Math.min(blob.size, start + CHUNK_SIZE));
      for (let i = 0; i < bytes.length; i++) counts[bytes[i]]++;
      report(options, 'read', start + bytes.length, blob.size);
    }
    return counts;
  }

  async function encodeBody(blob, codes, options) {
    const parts = [];
    const writer = new ChunkWriter(chunk => { parts.push(new Blob([chunk])); });
    const { length, value, bits } = codes;
    let acc = 0;
    let accBits = 0;

    report(options, 'encode', 0, blob.size);
    for (let start = 0; start < blob.size; start += CHUNK_SIZE) {
      checkCancelled(options);
      const bytes = await readSlice(blob, start, Math.min(blob.size, start + CHUNK_SIZE));
      const out = writer.buffer;
      let pos = writer.pos;
      for (let i = 0; i < bytes.length; i++) {
        const s = bytes[i];
        const len = length[s];
        if (len <= FAST_CODE_BITS) {
          acc = (acc << len) | value[s];
          accBits += len;
          while (accBits >= 8) {
            accBits -= 8;
            out[pos++] = (acc >>> accBits) & 0xff;
          }
          acc &= (1 << accBits) - 1;
        } else {
          for (const bit of bits[s]) {
            acc = (acc << 1) | bit;
            if (++accBits === 8) {
              out[pos++] = acc;
              acc = 0;
              accBits = 0;
            }
          }
        }
        // Leave room for the longest possible code before the buffer fills
        if (pos >= CHUNK_SIZE - 64) {
          writer.pos = pos;
          await writer.flush();
          pos = 0;
        }
      }
      writer.pos = pos;
      report(options, 'encode', start + bytes.length, blob.size);
    }
    if (accBits > 0) writer.buffer[writer.pos++] = (acc << (8 - accBits)) & 0xff;
    await writer.flush();
    return { parts, size: writer.written };
  }

  /**
   * Compresses a Blob or File into SB01.
   * options: { onProgress({phase, done, total}), isCancelled(), verify = true }
   * Phases in order: read, tree, encode, verify.
   */
  async function compress(blob, options = {}) {
    if (!blob || typeof blob.size !== 'number') throw new SB01Error(Status.INVALID_INPUT);
    if (blob.size > MAX_INPUT_BYTES) throw new SB01Error(Status.TOO_LARGE);

    const counts = await countBytes(blob, options);

    report(options, 'tree', 0, 1);
    const tree = buildTree(counts);
    const codes = tree ? buildCodes(tree) : null;
    report(options, 'tree', 1, 1);

    const header = writeHeader(blob.size, counts);
    const body = codes ? await encodeBody(blob, codes, options) : { parts: [], size: 0 };
    const archive = new Blob([header, ...body.parts], { type: 'application/octet-stream' });

    let verified = false;
    if (options.verify !== false) {
      await verifyRoundTrip(archive, blob, options);
      verified = true;
    }

    return {
      blob: archive,
      originalSize: blob.size,
      outputSize: archive.size,
      distinctBytes: tree ? tree.distinct : 0,
      verified
    };
  }

  // ------------------------------------------------------------------------
  // Decompression
  // ------------------------------------------------------------------------

  // Validates the header with the same checks, in the same order, as decompressBuffer() in C++.
  async function readHeader(blob) {
    const len = blob.size;
    if (len < 4) throw new SB01Error(Status.TRUNCATED_DATA);
    const head = await readSlice(blob, 0, Math.min(len, HEADER_SIZE + 256 * ENTRY_SIZE));
    for (let i = 0; i < 4; i++) {
      if (head[i] !== MAGIC[i]) throw new SB01Error(Status.BAD_MAGIC);
    }
    if (len < HEADER_SIZE) throw new SB01Error(Status.TRUNCATED_DATA);

    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const originalSize = view.getBigUint64(4, true);
    const uniqueCount = view.getUint16(12, true);
    if (uniqueCount > 256) throw new SB01Error(Status.CORRUPT_DATA);

    const tableEnd = HEADER_SIZE + uniqueCount * ENTRY_SIZE;
    if (len < tableEnd) throw new SB01Error(Status.TRUNCATED_DATA);

    const counts = new Float64Array(256);
    const seen = new Uint8Array(256);
    let freqSum = 0;
    for (let i = 0, pos = HEADER_SIZE; i < uniqueCount; i++, pos += ENTRY_SIZE) {
      const b = head[pos];
      const f = view.getUint32(pos + 1, true);
      if (f === 0 || f > INT_MAX) throw new SB01Error(Status.CORRUPT_DATA);
      if (seen[b]) throw new SB01Error(Status.CORRUPT_DATA);
      seen[b] = 1;
      counts[b] = f;
      freqSum += f;
    }
    if (BigInt(freqSum) !== originalSize) throw new SB01Error(Status.SIZE_MISMATCH);

    const size = Number(originalSize);
    if (size > MAX_OUTPUT_BYTES) throw new SB01Error(Status.TOO_LARGE);
    const payloadBytes = len - tableEnd;
    if (size > 0 && Math.floor(size / 8) > payloadBytes) throw new SB01Error(Status.TRUNCATED_DATA);

    return { originalSize: size, counts, tableEnd, distinct: uniqueCount };
  }

  // Decodes the bitstream after the header and passes output chunks to onChunk.
  async function decodeBody(blob, header, onChunk, options, phase) {
    const total = header.originalSize;
    const writer = new ChunkWriter(onChunk);
    if (total === 0) return 0;

    const tree = buildTree(header.counts);
    if (!tree) throw new SB01Error(Status.CORRUPT_DATA);
    const { left, right, symbol } = tree;
    const rootNode = tree.root;
    let node = rootNode;
    let produced = 0;

    const payloadEnd = blob.size;
    report(options, phase, 0, total);
    for (let start = header.tableEnd; start < payloadEnd && produced < total; start += CHUNK_SIZE) {
      checkCancelled(options);
      const bytes = await readSlice(blob, start, Math.min(payloadEnd, start + CHUNK_SIZE));
      const out = writer.buffer;
      let pos = writer.pos;
      for (let i = 0; i < bytes.length && produced < total; i++) {
        const byte = bytes[i];
        for (let bit = 7; bit >= 0 && produced < total; bit--) {
          node = (byte >> bit) & 1 ? right[node] : left[node];
          if (node < 0) throw new SB01Error(Status.CORRUPT_DATA);
          if (left[node] < 0 && right[node] < 0) {
            out[pos++] = symbol[node];
            produced++;
            node = rootNode;
            if (pos === CHUNK_SIZE) {
              writer.pos = pos;
              await writer.flush();
              pos = 0;
            }
          }
        }
      }
      writer.pos = pos;
      report(options, phase, produced, total);
    }
    await writer.flush();

    if (produced !== total) throw new SB01Error(Status.TRUNCATED_DATA);
    return produced;
  }

  /**
   * Decompresses an SB01 Blob or File.
   * options: { onProgress({phase, done, total}), isCancelled() }
   * Phases in order: read (header), tree, decode.
   */
  async function decompress(blob, options = {}) {
    if (!blob || typeof blob.size !== 'number') throw new SB01Error(Status.INVALID_INPUT);

    report(options, 'read', 0, blob.size);
    const header = await readHeader(blob);
    report(options, 'read', blob.size, blob.size);

    report(options, 'tree', 0, 1);
    report(options, 'tree', 1, 1);

    const parts = [];
    await decodeBody(blob, header, chunk => { parts.push(new Blob([chunk])); }, options, 'decode');
    const restored = new Blob(parts, { type: 'application/octet-stream' });

    return {
      blob: restored,
      archiveSize: blob.size,
      outputSize: restored.size,
      distinctBytes: header.distinct
    };
  }

  // Decodes a fresh archive and compares it, chunk by chunk, with the original input.
  async function verifyRoundTrip(archive, original, options) {
    const header = await readHeader(archive);
    if (header.originalSize !== original.size) throw new SB01Error(Status.SIZE_MISMATCH);
    let offset = 0;
    await decodeBody(archive, header, async chunk => {
      const expected = await readSlice(original, offset, offset + chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] !== expected[i]) throw new SB01Error(Status.CORRUPT_DATA);
      }
      offset += chunk.length;
    }, options, 'verify');
  }

  const SB01 = {
    compress,
    decompress,
    Status,
    STATUS_MESSAGES,
    SB01Error,
    MAX_INPUT_BYTES,
    CHUNK_SIZE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SB01;
  } else {
    root.SB01 = SB01;
  }
})(typeof self !== 'undefined' ? self : this);
