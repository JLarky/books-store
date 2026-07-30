import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  createBook,
  createShareInvite,
  getShareInvite,
  listBooksForOwner,
  markBookReceived,
} from "../app/data/books.ts";
import { ensureDevUser } from "../app/data/users.ts";

void test("owner can add a book and share viewers can mark it received", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "books-store-"));
  process.env.BOOKS_STORE_DATA_PATH = path.join(dir, "store.json");
  try {
    const user = await ensureDevUser();
    const created = await createBook({
      ownerId: user.id,
      description: "A calm mystery",
      contentType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const share = await createShareInvite(user.id);
    assert.ok(share);
    assert.equal((await getShareInvite(share!.id))?.ownerId, user.id);

    const before = await listBooksForOwner(user.id);
    assert.equal(before.length, 1);
    assert.equal(before[0]!.receivedAt, null);

    const received = await markBookReceived(created.book.id, user.id);
    assert.equal(received.ok, true);
    if (!received.ok) return;
    assert.ok(received.book.receivedAt);

    const after = await listBooksForOwner(user.id);
    assert.equal(after[0]!.receivedAt, received.book.receivedAt);
  } finally {
    delete process.env.BOOKS_STORE_DATA_PATH;
    await rm(dir, { recursive: true, force: true });
  }
});
