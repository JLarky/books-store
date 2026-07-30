import { randomUUID } from "node:crypto";
import { kvKey, openKv, readLocal, writeLocal } from "./kv.ts";
import { getUser } from "./users.ts";

export type Category = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
};

async function saveCategoryIndex(ownerId: string, categoryIds: string[]) {
  const kv = await openKv();
  if (kv) await kv.set(kvKey("usercategories", ownerId), categoryIds);
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  const kv = await openKv();
  if (kv) return (await kv.get<Category>(kvKey("category", categoryId))).value;
  return ((await readLocal()).categories[categoryId] as Category | undefined) ?? null;
}

export async function listCategoriesForOwner(ownerId: string): Promise<Category[]> {
  const kv = await openKv();
  if (kv) {
    const user = await getUser(ownerId);
    if (!user) return [];
    const ids = (await kv.get<string[]>(kvKey("usercategories", ownerId))).value ?? [];
    const categories: Category[] = [];
    for (const id of ids) {
      const category = (await kv.get<Category>(kvKey("category", id))).value;
      if (category) categories.push(category);
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  const store = await readLocal();
  return Object.values(store.categories)
    .map((entry) => entry as Category)
    .filter((category) => category.ownerId === ownerId)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function createCategory(args: {
  ownerId: string;
  name: string;
  description: string;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  if (!args.name.trim()) return { ok: false, error: "Name is required" };
  const category: Category = {
    id: randomUUID(),
    ownerId: args.ownerId,
    name: args.name.trim(),
    description: args.description.trim(),
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
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const category = await getCategory(args.categoryId);
  if (!category || category.ownerId !== args.ownerId)
    return { ok: false, error: "Category not found" };
  if (!args.name.trim()) return { ok: false, error: "Name is required" };
  const next = {
    ...category,
    name: args.name.trim(),
    description: args.description.trim(),
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
