import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { backupJson, buildOwnerBackup } from "../app/data/backup.ts";
import { createBook } from "../app/data/books.ts";
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

void test("owner backup includes categories, books, and cover images", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "books-store-backup-"));
  process.env.BOOKS_STORE_DATA_PATH = path.join(dir, "store.json");
  try {
    const user = await ensureDevUser();
    const category = await createCategory({
      ownerId: user.id,
      name: "Fiction",
      description: "Novels",
    });
    assert.equal(category.ok, true);
    if (!category.ok) return;

    const png = fakePng(120, 160);
    const created = await createBook({
      ownerId: user.id,
      description: "A calm mystery",
      categoryIds: [category.category.id],
      contentType: "image/png",
      bytes: png,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const backup = await buildOwnerBackup(user.id);
    assert.equal(backup.version, 1);
    assert.ok(backup.exportedAt);
    assert.equal(backup.categories.length, 1);
    assert.equal(backup.categories[0]?.name, "Fiction");
    assert.equal(backup.categories[0]?.description, "Novels");
    assert.equal(backup.books.length, 1);
    assert.equal(backup.books[0]?.description, "A calm mystery");
    assert.deepEqual(backup.books[0]?.categoryIds, [category.category.id]);
    assert.equal(backup.books[0]?.contentType, "image/png");
    assert.equal(backup.books[0]?.imageBase64, Buffer.from(png).toString("base64"));

    const json = backupJson(backup);
    const parsed = JSON.parse(json) as typeof backup;
    assert.equal(parsed.version, 1);
    assert.equal(parsed.books[0]?.imageBase64, backup.books[0]?.imageBase64);
  } finally {
    delete process.env.BOOKS_STORE_DATA_PATH;
    await rm(dir, { recursive: true, force: true });
  }
});
