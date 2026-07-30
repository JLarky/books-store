import assert from "node:assert/strict";
import test from "node:test";
import {
  bindShareSession,
  bindUserSession,
  clearShareSession,
  SESSION_MAX_AGE_SECONDS,
  shareId,
  userId,
} from "../app/middleware/auth-session.ts";

void test("session identity is bound to its exact hostname", () => {
  const values = new Map<string, unknown>();
  const state = {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
  };
  bindUserSession(state, new Request("https://books-store.example/app"), "user-1");

  assert.equal(userId(state, new Request("https://books-store.example/app")), "user-1");
  assert.equal(userId(state, new Request("https://books-store-preview.example/app")), null);
});

void test("share invite id is bound to its exact hostname until cleared", () => {
  const values = new Map<string, unknown>();
  const state = {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
    unset: (key: string) => {
      values.delete(key);
    },
  };
  bindShareSession(state, new Request("https://books-store.example/share/abc"), "share-1");

  assert.equal(shareId(state, new Request("https://books-store.example/")), "share-1");
  assert.equal(shareId(state, new Request("https://books-store-preview.example/")), null);

  clearShareSession(state);
  assert.equal(shareId(state, new Request("https://books-store.example/")), null);
});

void test("session cookies are configured to last about a year", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 365);
});
