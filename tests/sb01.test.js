// Tests for the SB01 codec. Run from the project root with: node --test
// The sample archives in sample_files/ were produced by the C++ CLI (HuffmanEncodercpp1.cpp),
// so the golden tests prove the browser codec stays byte-compatible with it.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SB01 = require('../sb01.js');

const samples = path.join(__dirname, '..', 'sample_files');
const read = name => fs.readFileSync(path.join(samples, name));
const bytesOf = async blob => Buffer.from(await blob.arrayBuffer());

async function roundTrip(data) {
  const packed = await SB01.compress(new Blob([data]));
  const restored = await SB01.decompress(packed.blob);
  return { packed, restored: await bytesOf(restored.blob) };
}

async function decompressError(bytes) {
  try {
    await SB01.decompress(new Blob([bytes]));
  } catch (err) {
    return err.message;
  }
  return 'OK';
}

const GOLDEN = [
  ['example_code.c', 'example_code.c.sb'],
  ['proposal_text.txt', 'proposal_text.txt.shrink']
];

for (const [original, archive] of GOLDEN) {
  test(`compressing ${original} matches the C++ archive byte for byte`, async () => {
    const result = await SB01.compress(new Blob([read(original)]));
    assert.deepStrictEqual(await bytesOf(result.blob), read(archive));
    assert.strictEqual(result.verified, true);
  });

  test(`decompressing the C++ archive ${archive} restores ${original}`, async () => {
    const result = await SB01.decompress(new Blob([read(archive)]));
    assert.deepStrictEqual(await bytesOf(result.blob), read(original));
  });
}

test('round trip: every sample file', async () => {
  for (const name of fs.readdirSync(samples)) {
    const data = read(name);
    const { restored } = await roundTrip(data);
    assert.deepStrictEqual(restored, data, name);
  }
});

test('round trip: empty, one byte, one repeated byte, all 256 values', async () => {
  const cases = [
    Buffer.alloc(0),
    Buffer.from('A'),
    Buffer.alloc(1000, 'Z'),
    Buffer.from(Array.from({ length: 256 }, (_, i) => i))
  ];
  for (const data of cases) {
    const { restored } = await roundTrip(data);
    assert.deepStrictEqual(restored, data);
  }
});

test('round trip: input larger than one 4 MB chunk', async () => {
  const data = Buffer.alloc(SB01.CHUNK_SIZE + 12345);
  let x = 7;
  for (let i = 0; i < data.length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    data[i] = (x >>> 24) % 17; // skewed so it compresses
  }
  const { packed, restored } = await roundTrip(data);
  assert.ok(packed.outputSize < data.length);
  assert.deepStrictEqual(restored, data);
});

test('round trip: codes longer than 24 bits use the slow path correctly', async () => {
  // Fibonacci-like counts produce a very deep tree
  const parts = [];
  let a = 1, b = 1;
  for (let s = 0; s < 30; s++) {
    parts.push(Buffer.alloc(a, s));
    [a, b] = [b, a + b];
  }
  const data = Buffer.concat(parts);
  const { restored } = await roundTrip(data);
  assert.deepStrictEqual(restored, data);
});

test('empty input gives the 14-byte header only', async () => {
  const result = await SB01.compress(new Blob([]));
  assert.strictEqual(result.outputSize, 14);
});

test('corrupt archives are rejected with the same messages as the C++ engine', async () => {
  const good = read('example_code.c.sb');
  const cases = [
    ['bad magic', b => { b[0] = 0x58; return b; }, 'Bad magic: not a ShrinkByte (SB01) file'],
    ['too short', b => b.subarray(0, 3), 'Truncated data: file ends too early'],
    ['truncated header', b => b.subarray(0, 8), 'Truncated data: file ends too early'],
    ['truncated payload', b => b.subarray(0, b.length - 10), 'Truncated data: file ends too early'],
    ['size mismatch', b => { b[4] ^= 1; return b; }, 'Size mismatch between header and data'],
    ['zero frequency', b => { b.writeUInt32LE(0, 15); return b; }, 'Corrupt data'],
    ['duplicate byte', b => { b[19] = b[14]; return b; }, 'Corrupt data'],
    ['more than 256 entries', b => { b.writeUInt16LE(300, 12); return b; }, 'Corrupt data']
  ];
  for (const [name, mutate, expected] of cases) {
    assert.strictEqual(await decompressError(mutate(Buffer.from(good))), expected, name);
  }
});

test('an archive claiming more than 1 GB of output is refused before decoding', async () => {
  // One distinct byte with a count just over 1 GB, and enough payload to pass the size check
  const size = SB01.MAX_INPUT_BYTES + 1;
  const header = Buffer.alloc(14 + 5);
  header.write('SB01', 0, 'latin1');
  header.writeBigUInt64LE(BigInt(size), 4);
  header.writeUInt16LE(1, 12);
  header[14] = 0x41;
  header.writeUInt32LE(size, 15);
  const archive = new Blob([header, new Uint8Array(Math.ceil(size / 8))]);
  await assert.rejects(SB01.decompress(archive), { status: SB01.Status.TOO_LARGE });
});

test('cancelling stops the job with a CANCELLED status', async () => {
  const data = new Blob([Buffer.alloc(SB01.CHUNK_SIZE * 2, 1)]);
  let calls = 0;
  await assert.rejects(
    SB01.compress(data, { isCancelled: () => ++calls > 1 }),
    { status: SB01.Status.CANCELLED }
  );
});

test('progress is reported in phase order and reaches the total', async () => {
  const seen = [];
  await SB01.compress(new Blob([read('example_code.c')]), {
    onProgress: p => seen.push(p)
  });
  const phases = [...new Set(seen.map(p => p.phase))];
  assert.deepStrictEqual(phases, ['read', 'tree', 'encode', 'verify']);
  for (const phase of phases) {
    const last = seen.filter(p => p.phase === phase).pop();
    assert.strictEqual(last.done, last.total, phase);
  }
});
