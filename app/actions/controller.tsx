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
} from "../data/users.ts";
import {
  createBook,
  createShareInvite,
  deleteBook,
  getBook,
  getBookImage,
  getShareInvite,
  listBooksForOwner,
  listShareInvites,
  markBookReceived,
  revokeShareInvite,
  updateBookDescription,
} from "../data/books.ts";
import { HomePage } from "../ui/home-page.tsx";
import { LoginPage } from "../ui/login-page.tsx";
import { AccessPage } from "../ui/access-page.tsx";
import { InvitePage } from "../ui/invite-page.tsx";
import { AccountPage, DashboardPage, SharePage } from "../ui/dashboard-page.tsx";
import { KV_NAMESPACE, kvKey, openKv, readLocal } from "../data/kv.ts";

function returnTo(value: string | null, fallback: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function healthResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function dashboard(
  ownerId: string,
  error: string | null = null,
  notice: string | null = null,
) {
  const user = await getUser(ownerId);
  if (!user) return null;
  const [books, shareInvites] = await Promise.all([
    listBooksForOwner(ownerId),
    listShareInvites(ownerId),
  ]);
  return { user, books, shareInvites, error, notice };
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
      const view = await dashboard(user.id);
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
      const id = userId(c.session, c.request);
      if (!id)
        return c.render(
          <AccessPage
            destination={routes.app.href()}
            title="Sign in to manage books"
            detail="Your book list is protected. Choose sign in to continue, or return home."
          />,
        );
      const user = await getUser(id);
      if (!user)
        return c.render(
          <AccessPage
            destination={routes.app.href()}
            title="Your session needs attention"
            detail="This session no longer matches a saved account. Sign out this session, then sign in again."
            staleSession
          />,
        );

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");

        if (intent === "add-book") {
          const image = form.get("image");
          if (!(image instanceof File)) {
            const view = await dashboard(id, "Image is required");
            return c.render(<DashboardPage {...view!} />, { status: 400 });
          }
          const bytes = new Uint8Array(await image.arrayBuffer());
          const result = await createBook({
            ownerId: id,
            description: text(form, "description"),
            contentType: image.type || "application/octet-stream",
            bytes,
          });
          const view = await dashboard(
            id,
            result.ok ? null : result.error,
            result.ok ? "Book added" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "update-description") {
          const result = await updateBookDescription(
            id,
            text(form, "bookId"),
            text(form, "description"),
          );
          const view = await dashboard(
            id,
            result.ok ? null : result.error,
            result.ok ? "Description saved" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "delete-book") {
          const result = await deleteBook(id, text(form, "bookId"));
          const view = await dashboard(
            id,
            result.ok ? null : result.error,
            result.ok ? "Book deleted" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }

        if (intent === "create-share") {
          const invite = await createShareInvite(id);
          const view = await dashboard(
            id,
            invite ? null : "Could not create invite",
            invite ? `Invite ready: /share/${invite.id}` : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: invite ? 200 : 500 });
        }

        if (intent === "revoke-share") {
          const result = await revokeShareInvite(id, text(form, "shareId"));
          const view = await dashboard(
            id,
            result.ok ? null : result.error,
            result.ok ? "Share link revoked" : null,
          );
          return c.render(<DashboardPage {...view!} />, { status: result.ok ? 200 : 400 });
        }
      }

      const view = await dashboard(id);
      return c.render(<DashboardPage {...view!} />);
    },
    async account(c) {
      const id = userId(c.session, c.request);
      if (!id)
        return c.render(
          <AccessPage
            destination={routes.account.href()}
            title="Sign in to manage devices"
            detail="Your account settings are protected. Choose sign in to continue, or return home."
          />,
        );
      const user = await getUser(id);
      if (!user)
        return c.render(
          <AccessPage
            destination={routes.account.href()}
            title="Your session needs attention"
            detail="This session no longer matches a saved account. Sign out this session, then sign in again."
            staleSession
          />,
        );

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
          <SharePage shareId={shareId} books={[]} error="Invite not found" notice={null} />,
          { status: 404 },
        );

      if (c.request.method === "POST") {
        const form = await c.request.formData();
        if (text(form, "intent") === "mark-received") {
          const result = await markBookReceived(text(form, "bookId"), invite.ownerId);
          const books = await listBooksForOwner(invite.ownerId);
          return c.render(
            <SharePage
              shareId={shareId}
              books={books}
              error={result.ok ? null : result.error}
              notice={result.ok ? "Marked as received" : null}
            />,
            { status: result.ok ? 200 : 400 },
          );
        }
      }

      const books = await listBooksForOwner(invite.ownerId);
      return c.render(<SharePage shareId={shareId} books={books} error={null} notice={null} />);
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
