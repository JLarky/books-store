import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Kv = {
  get<T>(key: readonly string[]): Promise<{ value: T | null }>;
  set(key: readonly string[], value: unknown): Promise<unknown>;
  delete?(key: readonly string[]): Promise<unknown>;
};

export const KV_NAMESPACE = "books-store";

export function kvKey(...parts: string[]): readonly string[] {
  return [KV_NAMESPACE, ...parts];
}

type DenoLike = { openKv(url?: string): Promise<Kv> };

function localPath() {
  return process.env.BOOKS_STORE_DATA_PATH
    ? path.resolve(process.cwd(), process.env.BOOKS_STORE_DATA_PATH)
    : path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/app-store.local.json");
}

export async function openKv(): Promise<Kv | null> {
  const deno = (globalThis as { Deno?: DenoLike }).Deno;
  return deno?.openKv ? deno.openKv(process.env.DENO_KV_URL) : null;
}

export type LocalStore = {
  users: Record<string, Record<string, unknown>>;
  books: Record<string, Record<string, unknown>>;
  bookImages: Record<string, string[]>;
  categories: Record<string, Record<string, unknown>>;
  shareInvites: Record<string, Record<string, unknown>>;
  credIndex: Record<string, string>;
  inviteIndex: Record<string, Record<string, unknown>>;
};

export async function readLocal(): Promise<LocalStore> {
  try {
    const parsed = JSON.parse(await readFile(localPath(), "utf8")) as Partial<LocalStore>;
    return {
      users: parsed.users ?? {},
      books: parsed.books ?? {},
      bookImages: parsed.bookImages ?? {},
      categories: parsed.categories ?? {},
      shareInvites: parsed.shareInvites ?? {},
      credIndex: parsed.credIndex ?? {},
      inviteIndex: parsed.inviteIndex ?? {},
    };
  } catch {
    return {
      users: {},
      books: {},
      bookImages: {},
      categories: {},
      shareInvites: {},
      credIndex: {},
      inviteIndex: {},
    };
  }
}

export async function writeLocal(store: LocalStore) {
  const file = localPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
