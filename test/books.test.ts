import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  createBook,
  createShareInvite,
  getShareInvite,
  listBooksInCategory,
  markBookReceived,
  unmarkBookReceived,
} from "../app/data/books.ts";
import { createCategory } from "../app/data/categories.ts";
import { ensureDevUser } from "../app/data/users.ts";

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

void test("books can belong to categories and be marked received", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "books-store-"));
  process.env.BOOKS_STORE_DATA_PATH = path.join(dir, "store.json");
  try {
    const user = await ensureDevUser();
    const category = await createCategory({
      ownerId: user.id,
      name: "Детские",
      description: "Для малышей",
    });
    assert.equal(category.ok, true);
    if (!category.ok) return;
    assert.equal(category.category.kind, "receive");

    const sending = await createCategory({
      ownerId: user.id,
      name: "На отправку",
      description: "Отдать",
      kind: "send",
    });
    assert.equal(sending.ok, true);
    if (!sending.ok) return;
    assert.equal(sending.category.kind, "send");

    const created = await createBook({
      ownerId: user.id,
      description: "A calm mystery",
      categoryIds: [category.category.id],
      contentType: "image/png",
      bytes: fakePng(120, 160),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.book.categoryIds, [category.category.id]);
    assert.equal(created.book.imageByteLength, fakePng(120, 160).byteLength);
    assert.equal(created.book.twoCopies, false);

    const twoCopies = await createBook({
      ownerId: user.id,
      description: "Two copies",
      categoryIds: [category.category.id],
      contentType: "image/png",
      bytes: fakePng(120, 160),
      twoCopies: true,
    });
    assert.equal(twoCopies.ok, true);
    if (!twoCopies.ok) return;
    assert.equal(twoCopies.book.twoCopies, true);

    const oversized = await createBook({
      ownerId: user.id,
      description: "Too big",
      contentType: "image/png",
      bytes: fakePng(601, 100),
    });
    assert.equal(oversized.ok, false);

    const inCategory = await listBooksInCategory(user.id, category.category.id);
    assert.equal(inCategory.length, 2);

    const share = await createShareInvite(user.id);
    assert.ok(share);
    assert.equal((await getShareInvite(share!.id))?.ownerId, user.id);

    const received = await markBookReceived(created.book.id, user.id);
    assert.equal(received.ok, true);
    if (!received.ok) return;
    assert.ok(received.book.receivedAt);

    const unmarked = await unmarkBookReceived(created.book.id, user.id);
    assert.equal(unmarked.ok, true);
    if (!unmarked.ok) return;
    assert.equal(unmarked.book.receivedAt, null);
  } finally {
    delete process.env.BOOKS_STORE_DATA_PATH;
    await rm(dir, { recursive: true, force: true });
  }
});
