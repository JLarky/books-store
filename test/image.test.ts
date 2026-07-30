import assert from "node:assert/strict";
import test from "node:test";
import {
  fitImageSize,
  getImageDimensions,
  IMAGE_EDGE_LADDER,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
  validateImageEdge,
} from "../app/utils/image.ts";

function fakePng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

function writeU32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeFourCC(bytes: Uint8Array, offset: number, value: string) {
  bytes[offset] = value.charCodeAt(0);
  bytes[offset + 1] = value.charCodeAt(1);
  bytes[offset + 2] = value.charCodeAt(2);
  bytes[offset + 3] = value.charCodeAt(3);
}

/** Minimal AVIF-like BMFF: ftyp(avif) + meta/iprp/ipco/ispe. */
function fakeAvif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(20 + 8 + 4 + 8 + 8 + 20);
  // ftyp (20)
  writeU32(bytes, 0, 20);
  writeFourCC(bytes, 4, "ftyp");
  writeFourCC(bytes, 8, "avif");
  writeU32(bytes, 12, 0);
  writeFourCC(bytes, 16, "avif");
  // meta FullBox containing iprp > ipco > ispe
  writeU32(bytes, 20, 8 + 4 + 8 + 8 + 20);
  writeFourCC(bytes, 24, "meta");
  writeU32(bytes, 28, 0); // version + flags
  writeU32(bytes, 32, 8 + 8 + 20);
  writeFourCC(bytes, 36, "iprp");
  writeU32(bytes, 40, 8 + 20);
  writeFourCC(bytes, 44, "ipco");
  writeU32(bytes, 48, 20);
  writeFourCC(bytes, 52, "ispe");
  writeU32(bytes, 56, 0); // version + flags
  writeU32(bytes, 60, width);
  writeU32(bytes, 64, height);
  return bytes;
}

void test("reads PNG dimensions from IHDR", () => {
  assert.deepEqual(getImageDimensions(fakePng(120, 80)), { width: 120, height: 80 });
});

void test("reads AVIF dimensions from ispe", () => {
  assert.deepEqual(getImageDimensions(fakeAvif(240, 160)), { width: 240, height: 160 });
  assert.equal(validateImageEdge(fakeAvif(600, 600)).ok, true);
  assert.equal(validateImageEdge(fakeAvif(601, 100)).ok, false);
});

void test(`rejects images larger than ${MAX_IMAGE_EDGE}px on either edge`, () => {
  assert.equal(validateImageEdge(fakePng(600, 600)).ok, true);
  assert.equal(validateImageEdge(fakePng(601, 100)).ok, false);
  assert.equal(validateImageEdge(fakePng(100, 601)).ok, false);
  const oversized = validateImageEdge(fakePng(640, 480));
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.match(oversized.error, /640×480/);
});

void test("fitImageSize scales down while preserving aspect ratio", () => {
  assert.deepEqual(fitImageSize(600, 600), { width: 600, height: 600 });
  assert.deepEqual(fitImageSize(150, 80), { width: 150, height: 80 });
  assert.deepEqual(fitImageSize(1056, 541), { width: 600, height: 307 });
  assert.deepEqual(fitImageSize(600, 1200), { width: 300, height: 600 });
  assert.deepEqual(fitImageSize(601, 100), { width: 600, height: 100 });
});

void test("image edge ladder starts at max edge and targets 15 KB", () => {
  assert.equal(IMAGE_EDGE_LADDER[0], MAX_IMAGE_EDGE);
  assert.equal(TARGET_IMAGE_BYTES, 15_000);
  assert.ok(IMAGE_EDGE_LADDER.every((edge, i, all) => i === 0 || edge < all[i - 1]!));
});
