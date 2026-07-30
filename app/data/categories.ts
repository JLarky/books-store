import { randomUUID } from "node:crypto";
import { kvKey, openKv, readLocal, writeLocal } from "./kv.ts";
import { getUser } from "./users.ts";

export type CategoryKind = "receive" | "send";

export type Category = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  kind: CategoryKind;
  createdAt: string;
};

export function parseCategoryKind(value: string | null | undefined): CategoryKind | null {
  if (value === "receive" || value === "send") return value;
  return null;
}

export function normalizeCategory(
  raw: Category | (Omit<Category, "kind"> & { kind?: string }),
): Category {
  const kind = parseCategoryKind(raw.kind) ?? "receive";
  return { ...raw, kind };
}

async function saveCategoryIndex(ownerId: string, categoryIds: string[]) {
  const kv = await openKv();
  if (kv) await kv.set(kvKey("usercategories", ownerId), categoryIds);
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  const kv = await openKv();
  if (kv) {
    const value = (await kv.get<Category>(kvKey("category", categoryId))).value;
    return value ? normalizeCategory(value) : null;
  }
  const raw = (await readLocal()).categories[categoryId] as Category | undefined;
  return raw ? normalizeCategory(raw) : null;
}

export async function listCategoriesForOwner(
  ownerId: string,
  kind?: CategoryKind | null,
): Promise<Category[]> {
  const kv = await openKv();
  let categories: Category[];
  if (kv) {
    const user = await getUser(ownerId);
    if (!user) return [];
    const ids = (await kv.get<string[]>(kvKey("usercategories", ownerId))).value ?? [];
    categories = [];
    for (const id of ids) {
      const category = (await kv.get<Category>(kvKey("category", id))).value;
      if (category) categories.push(normalizeCategory(category));
    }
  } else {
    const store = await readLocal();
    categories = Object.values(store.categories)
      .map((entry) => normalizeCategory(entry as Category))
      .filter((category) => category.ownerId === ownerId);
  }
  if (kind) categories = categories.filter((category) => category.kind === kind);
  return categories.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function createCategory(args: {
  ownerId: string;
  name: string;
  description: string;
  kind?: CategoryKind;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  if (!args.name.trim()) return { ok: false, error: "Name is required" };
  const category: Category = {
    id: randomUUID(),
    ownerId: args.ownerId,
    name: args.name.trim(),
    description: args.description.trim(),
    kind: args.kind ?? "receive",
    createdAt: new Date().toISOString(),
  };
  const kv = await openKv();
  if (kv) {
    await kv.set(kvKey("category", category.id), category);
    const ids = (await kv.get<string[]>(kvKey("usercategories", args.ownerId))).value ?? [];
    await saveCategoryIndex(args.ownerId, [category.id, ...ids]);
    return { ok: true, category };
  }
  const store = await readLocal();
  store.categories[category.id] = category;
  await writeLocal(store);
  return { ok: true, category };
}

export async function updateCategory(args: {
  ownerId: string;
  categoryId: string;
  name: string;
  description: string;
  kind?: CategoryKind;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const category = await getCategory(args.categoryId);
  if (!category || category.ownerId !== args.ownerId)
    return { ok: false, error: "Category not found" };
  if (!args.name.trim()) return { ok: false, error: "Name is required" };
  const next: Category = {
    ...category,
    name: args.name.trim(),
    description: args.description.trim(),
    kind: args.kind ?? category.kind,
  };
  const kv = await openKv();
  if (kv) await kv.set(kvKey("category", args.categoryId), next);
  else {
    const store = await readLocal();
    store.categories[args.categoryId] = next;
    await writeLocal(store);
  }
  return { ok: true, category: next };
}

export async function deleteCategory(
  ownerId: string,
  categoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const category = await getCategory(categoryId);
  if (!category || category.ownerId !== ownerId) return { ok: false, error: "Category not found" };
  const kv = await openKv();
  if (kv) {
    await kv.delete?.(kvKey("category", categoryId));
    const ids = ((await kv.get<string[]>(kvKey("usercategories", ownerId))).value ?? []).filter(
      (id) => id !== categoryId,
    );
    await saveCategoryIndex(ownerId, ids);
  } else {
    const store = await readLocal();
    delete store.categories[categoryId];
    await writeLocal(store);
  }
  return { ok: true };
}
