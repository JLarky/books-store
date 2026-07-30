import { createController } from "remix/router";
import { bindUserSession, devAuthEnabled, userId } from "../middleware/auth-session.ts";
import { routes } from "../routes.ts";
import {
  createDeviceInvite,
  ensureDevUser,
  getDeviceInvite,
  getUser,
  listPendingDeviceInvites,
  revokeDeviceInvite,
  type User,
} from "../data/users.ts";
import {
  createBook,
  createShareInvite,
  deleteBook,
  getBook,
  getBookImage,
  getShareInvite,
  listBooksForOwner,
  listBooksInCategory,
  listShareInvites,
  markBookReceived,
  removeCategoryFromBooks,
  revokeShareInvite,
  unmarkBookReceived,
  updateBook,
} from "../data/books.ts";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategoriesForOwner,
  updateCategory,
} from "../data/categories.ts";
import { backupJson, buildOwnerBackup } from "../data/backup.ts";
import { HomePage } from "../ui/home-page.tsx";
import { LoginPage } from "../ui/login-page.tsx";
import { AccessPage } from "../ui/access-page.tsx";
import { InvitePage } from "../ui/invite-page.tsx";
import {
  AccountPage,
  CategoriesPage,
  CategoryDetailPage,
  DashboardPage,
} from "../ui/dashboard-page.tsx";
import { ShareCategoriesPage, ShareCategoryPage } from "../ui/share-pages.tsx";
import { KV_NAMESPACE, kvKey, openKv, readLocal } from "../data/kv.ts";

function returnTo(value: string | null, fallback: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formCategoryIds(form: FormData): string[] {
  return form
    .getAll("categoryIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function healthResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function loadAuthedUser(
  session: { get(key: string): unknown },
  request: Request,
): Promise<{ id: string; user: User } | { missing: true } | { stale: true }> {
  const id = userId(session, request);
  if (!id) return { missing: true };
  const user = await getUser(id);
  if (!user) return { stale: true };
  return { id, user };
}

function accessMissing(destination: string) {
  return (
    <AccessPage
      destination={destination}
      title="Sign in to continue"
      detail="This page is protected. Choose sign in to continue, or return home."
    />
  );
}

function accessStale(destination: string) {
  return (
    <AccessPage
      destination={destination}
      title="Your session needs attention"
      detail="This session no longer matches a saved account. Sign out this session, then sign in again."
      staleSession
    />
  );
}

async function dashboardView(
  ownerId: string,
  error: string | null = null,
  notice: string | null = null,
) {
  const user = await getUser(ownerId);
  if (!user) return null;
  const [allBooks, categories, shareInvites, backup] = await Promise.all([
    listBooksForOwner(ownerId),
    listCategoriesForOwner(ownerId),
    listShareInvites(ownerId),
    buildOwnerBackup(ownerId),
  ]);
  const books = allBooks.filter((book) => book.categoryIds.length === 0);
  return {
    user,
    books,
    categories,
    shareInvites,
    backupJson: backupJson(backup),
    error,
    notice,
  };
}

async function categoriesView(
  ownerId: string,
  error: string | null = null,
  notice: string | null = null,
) {
  return {
    categories: await listCategoriesForOwner(ownerId),
    error,
    notice,
  };
}

async function categoryDetailView(
  ownerId: string,
  categoryId: string,
  error: string | null = null,
  notice: string | null = null,
) {
  const category = await getCategory(categoryId);
  if (!category || category.ownerId !== ownerId) return null;
  const [books, categories] = await Promise.all([
    listBooksInCategory(ownerId, categoryId),
    listCategoriesForOwner(ownerId),
  ]);
  return { category, books, categories, error, notice };
}

async function handleAddBook(
  ownerId: string,
  form: FormData,
  lockedCategoryId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const image = form.get("image");
  if (!(image instanceof File)) return { ok: false, error: "Image is required" };
  const categoryIds = formCategoryIds(form);
  if (lockedCategoryId && !categoryIds.includes(lockedCategoryId))
    categoryIds.push(lockedCategoryId);
  const result = await createBook({
    ownerId,
    description: text(form, "description"),
    categoryIds,
    contentType: image.type || "application/octet-stream",
    bytes: new Uint8Array(await image.arrayBuffer()),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

async function optionalImageFromForm(
  form: FormData,
): Promise<{ contentType: string; bytes: Uint8Array } | undefined> {
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) return undefined;
  return {
    contentType: image.type || "application/octet-stream",
    bytes: new Uint8Array(await image.arrayBuffer()),
  };
}

async function handleUpdateBook(
  ownerId: string,
  form: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const image = await optionalImageFromForm(form);
  const result = await updateBook(ownerId, text(form, "bookId"), {
    description: text(form, "description"),
    categoryIds: formCategoryIds(form),
    image,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export default createController(routes, {
  actions: {
    async health() {
      try {
        const kv = await openKv();
        if (kv) {
          await kv.get(kvKey("health"));
          return healthResponse({ ok: true, storage: "deno-kv", namespace: KV_NAMESPACE });
        }
        await readLocal();
        return healthResponse({ ok: true, storage: "local-json" });
      } catch {
        return healthResponse(
          { ok: false, storage: "unavailable", error: "Configured storage is unavailable" },
          503,
        );
      }
    },
    async home(c) {
      return c.render(<HomePage signedIn={userId(c.session, c.request) != null} />);
    },
    async login(c) {
      const id = userId(c.session, c.request);
      const url = new URL(c.request.url);
      const destination = returnTo(url.searchParams.get("returnTo"), "/app");
      return c.render(
        <LoginPage
          returnTo={destination}
          error={url.searchParams.get("error")}
          devAuthEnabled={devAuthEnabled()}
          signedIn={id != null}
        />,
      );
    },
    async devLogin(c) {
      if (!devAuthEnabled()) return new Response("Not Found", { status: 404 });
      const user = await ensureDevUser();
      c.session.regenerateId();
      bindUserSession(c.session, c.request, user.id);
      const form = await c.request.formData();
      const destination = returnTo(text(form, "returnTo"), "/app");
      if (destination !== "/app")
        return Response.redirect(new URL(destination, c.request.url), 303);
      const view = await dashboardView(user.id);
      if (!view) return new Response("Not Found", { status: 404 });
      return c.render(<DashboardPage {...view} />);
    },
    async logout(c) {
      c.session.unset("userId");
      c.session.unset("sessionHost");
      c.session.unset("challenge");
      return Response.redirect(new URL("/", c.request.url), 303);
    },
    async app(c) {
      const auth = await loadAuthedUser(c.session, c.request);
      if ("missing" in auth) return c.render(accessMissing(routes.app.href()));
      if ("stale" in auth) return c.render(accessStale(routes.app.href()));

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");

        if (intent === "update-book") {
          const result = await handleUpdateBook(auth.id, form);
          const view = await dashboardView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Book saved" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "delete-book") {
          const result = await deleteBook(auth.id, text(form, "bookId"));
          const view = await dashboardView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Book deleted" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "create-share") {
          const invite = await createShareInvite(auth.id);
          const view = await dashboardView(
            auth.id,
            invite ? null : "Could not create invite",
            invite ? `Invite ready: /share/${invite.id}` : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: invite ? 200 : 500 });
        }

        if (intent === "revoke-share") {
          const result = await revokeShareInvite(auth.id, text(form, "shareId"));
          const view = await dashboardView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Share link revoked" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }
      }

      const view = await dashboardView(auth.id);
      return c.render(<DashboardPage {...view!} />);
    },
    async categories(c) {
      const auth = await loadAuthedUser(c.session, c.request);
      if ("missing" in auth) return c.render(accessMissing(routes.categories.href()));
      if ("stale" in auth) return c.render(accessStale(routes.categories.href()));

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");

        if (intent === "create-category") {
          const result = await createCategory({
            ownerId: auth.id,
            name: text(form, "name"),
            description: text(form, "description"),
          });
          const view = await categoriesView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Category created" : null,
          );
          return c.render(<CategoriesPage {...view} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "update-category") {
          const result = await updateCategory({
            ownerId: auth.id,
            categoryId: text(form, "categoryId"),
            name: text(form, "name"),
            description: text(form, "description"),
          });
          const view = await categoriesView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Category saved" : null,
          );
          return c.render(<CategoriesPage {...view} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "delete-category") {
          const categoryId = text(form, "categoryId");
          await removeCategoryFromBooks(auth.id, categoryId);
          const result = await deleteCategory(auth.id, categoryId);
          const view = await categoriesView(
            auth.id,
            result.ok ? null : result.error,
            result.ok ? "Category deleted" : null,
          );
          return c.render(<CategoriesPage {...view} />, { status: result.ok ? 200 : 400 });
        }
      }

      return c.render(<CategoriesPage {...await categoriesView(auth.id)} />);
    },
    async category(c) {
      const auth = await loadAuthedUser(c.session, c.request);
      const categoryPath = `/app/categories/${c.params.categoryId}`;
      if ("missing" in auth) return c.render(accessMissing(categoryPath));
      if ("stale" in auth) return c.render(accessStale(categoryPath));
      const categoryId = c.params.categoryId;

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");

        if (intent === "add-book") {
          const result = await handleAddBook(auth.id, form, categoryId);
          const view = await categoryDetailView(
            auth.id,
            categoryId,
            result.ok ? null : result.error,
            result.ok ? "Book added" : null,
          );
          if (!view) return new Response("Not Found", { status: 404 });
          return c.render(<CategoryDetailPage {...view} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "update-book") {
          const result = await handleUpdateBook(auth.id, form);
          const view = await categoryDetailView(
            auth.id,
            categoryId,
            result.ok ? null : result.error,
            result.ok ? "Book saved" : null,
          );
          if (!view) return new Response("Not Found", { status: 404 });
          return c.render(<CategoryDetailPage {...view} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "delete-book") {
          const result = await deleteBook(auth.id, text(form, "bookId"));
          const view = await categoryDetailView(
            auth.id,
            categoryId,
            result.ok ? null : result.error,
            result.ok ? "Book deleted" : null,
          );
          if (!view) return new Response("Not Found", { status: 404 });
          return c.render(<CategoryDetailPage {...view} />, { status: result.ok ? 200 : 400 });
        }
      }

      const view = await categoryDetailView(auth.id, categoryId);
      if (!view) return new Response("Not Found", { status: 404 });
      return c.render(<CategoryDetailPage {...view} />);
    },
    async account(c) {
      const auth = await loadAuthedUser(c.session, c.request);
      if ("missing" in auth) return c.render(accessMissing(routes.account.href()));
      if ("stale" in auth) return c.render(accessStale(routes.account.href()));
      const { id, user } = auth;

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");
        if (intent === "create-device-invite") {
          const invite = await createDeviceInvite(id);
          if (!invite)
            return c.render(
              <AccountPage
                user={user}
                pendingInvites={listPendingDeviceInvites(user)}
                error="Could not create invite"
                notice={null}
              />,
              { status: 500 },
            );
          const refreshed = (await getUser(id)) ?? user;
          return c.render(
            <AccountPage
              user={refreshed}
              pendingInvites={listPendingDeviceInvites(refreshed)}
              error={null}
              notice={`Invite ready: /invite/${invite.id}`}
            />,
          );
        }
        if (intent === "revoke-device-invite") {
          const result = await revokeDeviceInvite(id, text(form, "inviteId"));
          const refreshed = (await getUser(id)) ?? user;
          return c.render(
            <AccountPage
              user={refreshed}
              pendingInvites={listPendingDeviceInvites(refreshed)}
              error={result.ok ? null : result.error}
              notice={result.ok ? "Invite revoked" : null}
            />,
            { status: result.ok ? 200 : 400 },
          );
        }
      }

      return c.render(
        <AccountPage
          user={user}
          pendingInvites={listPendingDeviceInvites(user)}
          error={null}
          notice={null}
        />,
      );
    },
    async invite(c) {
      const inviteId = c.params.inviteId;
      const invite = await getDeviceInvite(inviteId);
      if (!invite)
        return c.render(
          <InvitePage inviteId={inviteId} error="Invite not found" signedIn={false} />,
          { status: 404 },
        );
      if (invite.claimedAt)
        return c.render(
          <InvitePage inviteId={inviteId} error="Invite already used" signedIn={false} />,
          { status: 400 },
        );
      if (Date.parse(invite.expiresAt) < Date.now())
        return c.render(
          <InvitePage inviteId={inviteId} error="Invite expired" signedIn={false} />,
          { status: 400 },
        );
      return c.render(
        <InvitePage
          inviteId={inviteId}
          error={null}
          signedIn={userId(c.session, c.request) != null}
        />,
      );
    },
    async share(c) {
      const shareId = c.params.shareId;
      const invite = await getShareInvite(shareId);
      if (!invite)
        return c.render(
          <ShareCategoriesPage shareId={shareId} categories={[]} error="Ссылка не найдена" />,
          { status: 404 },
        );
      const categories = await listCategoriesForOwner(invite.ownerId);
      return c.render(
        <ShareCategoriesPage shareId={shareId} categories={categories} error={null} />,
      );
    },
    async shareCategory(c) {
      const { shareId, categoryId } = c.params;
      const invite = await getShareInvite(shareId);
      if (!invite)
        return c.render(
          <ShareCategoriesPage shareId={shareId} categories={[]} error="Ссылка не найдена" />,
          { status: 404 },
        );
      const category = await getCategory(categoryId);
      if (!category || category.ownerId !== invite.ownerId)
        return c.render(
          <ShareCategoriesPage
            shareId={shareId}
            categories={await listCategoriesForOwner(invite.ownerId)}
            error="Категория не найдена"
          />,
          { status: 404 },
        );

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");
        if (intent === "mark-received" || intent === "unmark-received") {
          const result =
            intent === "mark-received"
              ? await markBookReceived(text(form, "bookId"), invite.ownerId)
              : await unmarkBookReceived(text(form, "bookId"), invite.ownerId);
          const books = await listBooksInCategory(invite.ownerId, categoryId);
          return c.render(
            <ShareCategoryPage
              shareId={shareId}
              category={category}
              books={books}
              error={result.ok ? null : "Не удалось изменить отметку"}
              notice={
                result.ok
                  ? intent === "mark-received"
                    ? "Книга отмечена как полученная"
                    : "Отметка о получении снята"
                  : null
              }
            />,
            { status: result.ok ? 200 : 400 },
          );
        }
      }

      const books = await listBooksInCategory(invite.ownerId, categoryId);
      return c.render(
        <ShareCategoryPage
          shareId={shareId}
          category={category}
          books={books}
          error={null}
          notice={null}
        />,
      );
    },
    async bookImage(c) {
      const bookId = c.params.bookId;
      const book = await getBook(bookId);
      if (!book) return new Response("Not Found", { status: 404 });

      const id = userId(c.session, c.request);
      const shareId = new URL(c.request.url).searchParams.get("share");
      const share = shareId ? await getShareInvite(shareId) : null;
      const allowed =
        (id != null && id === book.ownerId) || (share != null && share.ownerId === book.ownerId);
      if (!allowed) return new Response("Forbidden", { status: 403 });

      const image = await getBookImage(bookId);
      if (!image) return new Response("Not Found", { status: 404 });
      return new Response(Buffer.from(image.bytes), {
        headers: {
          "content-type": image.contentType,
          "cache-control": "private, max-age=3600",
        },
      });
    },
  },
});
