import assert from "node:assert/strict";
import test from "node:test";
import { KV_NAMESPACE, kvKey } from "../app/data/kv.ts";

void test("Books Store KV keys use an app-specific namespace", () => {
  assert.equal(KV_NAMESPACE, "books-store");
  assert.deepEqual(kvKey("user", "example"), ["books-store", "user", "example"]);
  assert.deepEqual(kvKey("book", "b1"), ["books-store", "book", "b1"]);
  assert.deepEqual(kvKey("category", "c1"), ["books-store", "category", "c1"]);
  assert.deepEqual(kvKey("share", "s1"), ["books-store", "share", "s1"]);
  assert.deepEqual(kvKey("bookimg", "b1", "0"), ["books-store", "bookimg", "b1", "0"]);
});
