import assert from "node:assert/strict";
import test from "node:test";
import { getImageDimensions, MAX_IMAGE_EDGE, validateImageEdge } from "../app/utils/image.ts";

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

void test("reads PNG dimensions from IHDR", () => {
  assert.deepEqual(getImageDimensions(fakePng(120, 80)), { width: 120, height: 80 });
});

void test(`rejects images larger than ${MAX_IMAGE_EDGE}px on either edge`, () => {
  assert.equal(validateImageEdge(fakePng(300, 300)).ok, true);
  assert.equal(validateImageEdge(fakePng(301, 100)).ok, false);
  assert.equal(validateImageEdge(fakePng(100, 301)).ok, false);
  const oversized = validateImageEdge(fakePng(640, 480));
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.match(oversized.error, /640×480/);
});
