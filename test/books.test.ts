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
} from "../app/data/books.ts";
import { createCategory } from "../app/data/categories.ts";
import { ensureDevUser } from "../app/data/users.ts";

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

    const created = await createBook({
      ownerId: user.id,
      description: "A calm mystery",
      categoryIds: [category.category.id],
      contentType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.book.categoryIds, [category.category.id]);

    const inCategory = await listBooksInCategory(user.id, category.category.id);
    assert.equal(inCategory.length, 1);

    const share = await createShareInvite(user.id);
    assert.ok(share);
    assert.equal((await getShareInvite(share!.id))?.ownerId, user.id);

    const received = await markBookReceived(created.book.id, user.id);
    assert.equal(received.ok, true);
    if (!received.ok) return;
    assert.ok(received.book.receivedAt);
  } finally {
    delete process.env.BOOKS_STORE_DATA_PATH;
    await rm(dir, { recursive: true, force: true });
  }
});
