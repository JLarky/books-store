import { randomUUID } from "node:crypto";
import { kvKey, openKv, readLocal, writeLocal } from "./kv.ts";
import { getUser, saveUser } from "./users.ts";
import { validateImageEdge } from "../utils/image.ts";

export type Book = {
  id: string;
  ownerId: string;
  description: string;
  categoryIds: string[];
  contentType: string;
  chunkCount: number;
  imageByteLength: number | null;
  createdAt: string;
  receivedAt: string | null;
};

function normalizeBook(book: Book): Book {
  return {
    ...book,
    categoryIds: book.categoryIds ?? [],
    imageByteLength: book.imageByteLength ?? null,
  };
}

export type ShareInvite = {
  id: string;
  ownerId: string;
  createdAt: string;
};

const CHUNK_CHARS = 48_000;
const MAX_IMAGE_BYTES = 2_000_000;

function encodeChunks(bytes: Uint8Array): string[] {
  const base64 = Buffer.from(bytes).toString("base64");
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS)
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  return chunks.length > 0 ? chunks : [""];
}

async function setImageChunks(bookId: string, chunks: string[]) {
  const kv = await openKv();
  if (kv) {
    for (let i = 0; i < chunks.length; i++)
      await kv.set(kvKey("bookimg", bookId, String(i)), chunks[i]);
    return;
  }
  const store = await readLocal();
  store.bookImages[bookId] = chunks;
  await writeLocal(store);
}

async function deleteImageChunks(bookId: string, chunkCount: number) {
  const kv = await openKv();
  if (kv) {
    for (let i = 0; i < chunkCount; i++) await kv.delete?.(kvKey("bookimg", bookId, String(i)));
    return;
  }
  const store = await readLocal();
  delete store.bookImages[bookId];
  await writeLocal(store);
}

export async function getBook(bookId: string): Promise<Book | null> {
  const kv = await openKv();
  const book = kv
    ? (await kv.get<Book>(kvKey("book", bookId))).value
    : (((await readLocal()).books[bookId] as Book | undefined) ?? null);
  return book ? normalizeBook(book) : null;
}

export async function listBooksForOwner(ownerId: string): Promise<Book[]> {
  const kv = await openKv();
  if (kv) {
    const user = await getUser(ownerId);
    if (!user) return [];
    const ids = (await kv.get<string[]>(kvKey("userbooks", ownerId))).value ?? [];
    const books: Book[] = [];
    for (const id of ids) {
      const book = (await kv.get<Book>(kvKey("book", id))).value;
      if (book) books.push(normalizeBook(book));
    }
    return books.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const store = await readLocal();
  return Object.values(store.books)
    .map((entry) => normalizeBook(entry as Book))
    .filter((book) => book.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listBooksInCategory(ownerId: string, categoryId: string): Promise<Book[]> {
  const books = await listBooksForOwner(ownerId);
  return books.filter((book) => book.categoryIds.includes(categoryId));
}

async function saveBookIndex(ownerId: string, bookIds: string[]) {
  const kv = await openKv();
  if (kv) await kv.set(kvKey("userbooks", ownerId), bookIds);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export async function createBook(args: {
  ownerId: string;
  description: string;
  categoryIds?: string[];
  contentType: string;
  bytes: Uint8Array;
}): Promise<{ ok: true; book: Book } | { ok: false; error: string }> {
  if (!args.description.trim()) return { ok: false, error: "Description is required" };
  if (!args.contentType.startsWith("image/")) return { ok: false, error: "File must be an image" };
  if (args.bytes.byteLength === 0) return { ok: false, error: "Image is required" };
  if (args.bytes.byteLength > MAX_IMAGE_BYTES)
    return { ok: false, error: "Image must be 2 MB or smaller" };
  const dimensions = validateImageEdge(args.bytes);
  if (!dimensions.ok) return dimensions;

  const chunks = encodeChunks(args.bytes);
  const book: Book = {
    id: randomUUID(),
    ownerId: args.ownerId,
    description: args.description.trim(),
    categoryIds: uniqueIds(args.categoryIds ?? []),
    contentType: args.contentType,
    chunkCount: chunks.length,
    imageByteLength: args.bytes.byteLength,
    createdAt: new Date().toISOString(),
    receivedAt: null,
  };

  const kv = await openKv();
  if (kv) {
    await kv.set(kvKey("book", book.id), book);
    await setImageChunks(book.id, chunks);
    const ids = (await kv.get<string[]>(kvKey("userbooks", args.ownerId))).value ?? [];
    await saveBookIndex(args.ownerId, [book.id, ...ids]);
    return { ok: true, book };
  }

  const store = await readLocal();
  store.books[book.id] = book;
  store.bookImages[book.id] = chunks;
  await writeLocal(store);
  return { ok: true, book };
}

export async function updateBook(
  ownerId: string,
  bookId: string,
  args: {
    description: string;
    categoryIds?: string[];
    image?: { contentType: string; bytes: Uint8Array };
  },
): Promise<{ ok: true; book: Book } | { ok: false; error: string }> {
  const book = await getBook(bookId);
  if (!book || book.ownerId !== ownerId) return { ok: false, error: "Book not found" };
  if (!args.description.trim()) return { ok: false, error: "Description is required" };

  let next: Book = {
    ...book,
    description: args.description.trim(),
    categoryIds: args.categoryIds == null ? book.categoryIds : uniqueIds(args.categoryIds),
  };

  if (args.image) {
    if (!args.image.contentType.startsWith("image/"))
      return { ok: false, error: "File must be an image" };
    if (args.image.bytes.byteLength === 0) return { ok: false, error: "Image is required" };
    if (args.image.bytes.byteLength > MAX_IMAGE_BYTES)
      return { ok: false, error: "Image must be 2 MB or smaller" };
    const dimensions = validateImageEdge(args.image.bytes);
    if (!dimensions.ok) return dimensions;
    const chunks = encodeChunks(args.image.bytes);
    await deleteImageChunks(bookId, book.chunkCount);
    await setImageChunks(bookId, chunks);
    next = {
      ...next,
      contentType: args.image.contentType,
      chunkCount: chunks.length,
      imageByteLength: args.image.bytes.byteLength,
    };
  }

  const kv = await openKv();
  if (kv) await kv.set(kvKey("book", bookId), next);
  else {
    const store = await readLocal();
    store.books[bookId] = next;
    await writeLocal(store);
  }
  return { ok: true, book: next };
}

export async function removeCategoryFromBooks(ownerId: string, categoryId: string) {
  const books = await listBooksForOwner(ownerId);
  for (const book of books) {
    if (!book.categoryIds.includes(categoryId)) continue;
    await updateBook(ownerId, book.id, {
      description: book.description,
      categoryIds: book.categoryIds.filter((id) => id !== categoryId),
    });
  }
}

export async function deleteBook(
  ownerId: string,
  bookId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const book = await getBook(bookId);
  if (!book || book.ownerId !== ownerId) return { ok: false, error: "Book not found" };
  await deleteImageChunks(bookId, book.chunkCount);
  const kv = await openKv();
  if (kv) {
    await kv.delete?.(kvKey("book", bookId));
    const ids = ((await kv.get<string[]>(kvKey("userbooks", ownerId))).value ?? []).filter(
      (id) => id !== bookId,
    );
    await saveBookIndex(ownerId, ids);
    return { ok: true };
  }
  const store = await readLocal();
  delete store.books[bookId];
  delete store.bookImages[bookId];
  await writeLocal(store);
  return { ok: true };
}

export async function markBookReceived(
  bookId: string,
  ownerId: string,
): Promise<{ ok: true; book: Book } | { ok: false; error: string }> {
  const book = await getBook(bookId);
  if (!book || book.ownerId !== ownerId) return { ok: false, error: "Book not found" };
  if (book.receivedAt) return { ok: true, book };
  const next = { ...book, receivedAt: new Date().toISOString() };
  const kv = await openKv();
  if (kv) await kv.set(kvKey("book", bookId), next);
  else {
    const store = await readLocal();
    store.books[bookId] = next;
    await writeLocal(store);
  }
  return { ok: true, book: next };
}

export async function unmarkBookReceived(
  bookId: string,
  ownerId: string,
): Promise<{ ok: true; book: Book } | { ok: false; error: string }> {
  const book = await getBook(bookId);
  if (!book || book.ownerId !== ownerId) return { ok: false, error: "Book not found" };
  if (!book.receivedAt) return { ok: true, book };
  const next = { ...book, receivedAt: null };
  const kv = await openKv();
  if (kv) await kv.set(kvKey("book", bookId), next);
  else {
    const store = await readLocal();
    store.books[bookId] = next;
    await writeLocal(store);
  }
  return { ok: true, book: next };
}

export async function getBookImage(
  bookId: string,
): Promise<{ contentType: string; bytes: Uint8Array } | null> {
  const book = await getBook(bookId);
  if (!book) return null;
  const kv = await openKv();
  const chunks: string[] = [];
  if (kv) {
    for (let i = 0; i < book.chunkCount; i++) {
      const chunk = (await kv.get<string>(kvKey("bookimg", bookId, String(i)))).value;
      if (chunk == null) return null;
      chunks.push(chunk);
    }
  } else {
    const stored = (await readLocal()).bookImages[bookId];
    if (!stored || stored.length !== book.chunkCount) return null;
    chunks.push(...stored);
  }
  return { contentType: book.contentType, bytes: Buffer.from(chunks.join(""), "base64") };
}

export async function createShareInvite(ownerId: string): Promise<ShareInvite | null> {
  const user = await getUser(ownerId);
  if (!user) return null;
  const invite: ShareInvite = {
    id: randomUUID(),
    ownerId,
    createdAt: new Date().toISOString(),
  };
  const kv = await openKv();
  if (kv) {
    await kv.set(kvKey("share", invite.id), invite);
  } else {
    const store = await readLocal();
    store.shareInvites[invite.id] = invite;
    await writeLocal(store);
  }
  await saveUser({ ...user, shareInviteIds: [...user.shareInviteIds, invite.id] });
  return invite;
}

export async function getShareInvite(shareId: string): Promise<ShareInvite | null> {
  const kv = await openKv();
  if (kv) return (await kv.get<ShareInvite>(kvKey("share", shareId))).value;
  return ((await readLocal()).shareInvites[shareId] as ShareInvite | undefined) ?? null;
}

export async function listShareInvites(ownerId: string): Promise<ShareInvite[]> {
  const user = await getUser(ownerId);
  if (!user) return [];
  const invites: ShareInvite[] = [];
  for (const id of user.shareInviteIds) {
    const invite = await getShareInvite(id);
    if (invite) invites.push(invite);
  }
  return invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeShareInvite(
  ownerId: string,
  shareId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUser(ownerId);
  const invite = await getShareInvite(shareId);
  if (!user || !invite || invite.ownerId !== ownerId)
    return { ok: false, error: "Invite not found" };
  const kv = await openKv();
  if (kv) await kv.delete?.(kvKey("share", shareId));
  else {
    const store = await readLocal();
    delete store.shareInvites[shareId];
    await writeLocal(store);
  }
  await saveUser({
    ...user,
    shareInviteIds: user.shareInviteIds.filter((id) => id !== shareId),
  });
  return { ok: true };
}
