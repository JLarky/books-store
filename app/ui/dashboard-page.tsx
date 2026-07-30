import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { Book, ShareInvite } from "../data/books.ts";
import type { DeviceInvite, User } from "../data/users.ts";
import { Document } from "./document.tsx";
import { button, muted, shell, brandMark, displayTitle } from "./styles.ts";

function formatReceived(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DashboardPage(
  h: Handle<{
    user: User;
    books: Book[];
    shareInvites: ShareInvite[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { books, shareInvites, error, notice } = h.props;
  return () => (
    <Document title="Dashboard · Books Store">
      <main mix={shell}>
        <nav
          mix={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          })}
        >
          <strong mix={css({ fontFamily: "Fraunces, Georgia, serif", fontSize: "22px" })}>
            Books Store
          </strong>
          <div mix={css({ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" })}>
            <a href="/account" mix={button({ secondary: true })}>
              Account
            </a>
            <form method="POST" action="/logout">
              <button type="submit" mix={button({ secondary: true })}>
                Sign out
              </button>
            </form>
          </div>
        </nav>

        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Your list</p>
          <h1 mix={displayTitle}>Books dashboard</h1>
          <p mix={css(muted)}>
            Upload a cover image and a short description. Create a share link so others can view the
            list and mark books as received.
          </p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>

        <section
          mix={css({
            maxWidth: "720px",
            marginBottom: "48px",
            padding: "24px",
            background: "#261f1a",
            border: "1px solid #4a4036",
            borderRadius: "20px",
          })}
        >
          <h2 mix={css({ margin: "0 0 16px", fontFamily: "Fraunces, Georgia, serif" })}>
            Add a book
          </h2>
          <form
            method="POST"
            action="/app"
            encType="multipart/form-data"
            mix={css({ display: "flex", flexDirection: "column", gap: "14px" })}
          >
            <input type="hidden" name="intent" value="add-book" />
            <label>
              Cover image
              <input type="file" name="image" accept="image/*" required />
            </label>
            <label>
              Description
              <textarea name="description" required placeholder="Title, notes, why it matters…" />
            </label>
            <button type="submit" mix={button()}>
              Add book
            </button>
          </form>
        </section>

        <section mix={css({ maxWidth: "720px", marginBottom: "48px" })}>
          <h2 mix={css({ fontFamily: "Fraunces, Georgia, serif" })}>Books</h2>
          {books.length === 0 ? (
            <p mix={css(muted)}>No books yet. Add your first cover and description above.</p>
          ) : (
            <ul
              mix={css({
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              })}
            >
              {books.map((book) => (
                <li
                  key={book.id}
                  mix={css({
                    display: "grid",
                    gridTemplateColumns: "minmax(96px, 140px) 1fr",
                    gap: "18px",
                    padding: "18px",
                    background: "#261f1a",
                    border: "1px solid #4a4036",
                    borderRadius: "18px",
                    "@media (max-width: 560px)": { gridTemplateColumns: "1fr" },
                  })}
                >
                  <img
                    src={`/books/${book.id}/image`}
                    alt=""
                    mix={css({
                      width: "100%",
                      aspectRatio: "3 / 4",
                      objectFit: "cover",
                      borderRadius: "12px",
                      background: "#141210",
                    })}
                  />
                  <div>
                    <p mix={css({ margin: "0 0 12px", whiteSpace: "pre-wrap" })}>
                      {book.description}
                    </p>
                    {book.receivedAt ? (
                      <p mix={css({ ...muted, margin: "0 0 12px", fontSize: "14px" })}>
                        Received {formatReceived(book.receivedAt)}
                      </p>
                    ) : (
                      <p mix={css({ ...muted, margin: "0 0 12px", fontSize: "14px" })}>
                        Not received yet
                      </p>
                    )}
                    <form
                      method="POST"
                      action="/app"
                      mix={css({ display: "flex", flexDirection: "column", gap: "10px" })}
                    >
                      <input type="hidden" name="intent" value="update-description" />
                      <input type="hidden" name="bookId" value={book.id} />
                      <label>
                        Edit description
                        <textarea name="description" value={book.description} />
                      </label>
                      <div mix={css({ display: "flex", gap: "10px", flexWrap: "wrap" })}>
                        <button type="submit" mix={button({ secondary: true })}>
                          Save description
                        </button>
                      </div>
                    </form>
                    <form method="POST" action="/app" mix={css({ marginTop: "8px" })}>
                      <input type="hidden" name="intent" value="delete-book" />
                      <input type="hidden" name="bookId" value={book.id} />
                      <button type="submit" mix={button({ secondary: true })}>
                        Delete book
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          mix={css({
            maxWidth: "720px",
            marginBottom: "64px",
            padding: "24px",
            background: "#261f1a",
            border: "1px solid #4a4036",
            borderRadius: "20px",
          })}
        >
          <h2 mix={css({ margin: "0 0 8px", fontFamily: "Fraunces, Georgia, serif" })}>
            Share links
          </h2>
          <p mix={css({ ...muted, marginTop: 0 })}>
            Anyone with a share link can view the list and press “I’ve received that book.” They
            cannot add or edit books.
          </p>
          <form method="POST" action="/app">
            <input type="hidden" name="intent" value="create-share" />
            <button type="submit" mix={button()}>
              Create invite link
            </button>
          </form>
          {shareInvites.length > 0 ? (
            <ul mix={css({ listStyle: "none", margin: "20px 0 0", padding: 0 })}>
              {shareInvites.map((invite) => (
                <li
                  key={invite.id}
                  mix={css({
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: "12px 0",
                    borderTop: "1px solid #4a4036",
                  })}
                >
                  <code mix={css({ color: "#c4b5a0", fontSize: "13px" })}>/share/{invite.id}</code>
                  <a href={`/share/${invite.id}`} mix={css({ color: "#c4b5a0" })}>
                    Open
                  </a>
                  <form method="POST" action="/app">
                    <input type="hidden" name="intent" value="revoke-share" />
                    <input type="hidden" name="shareId" value={invite.id} />
                    <button
                      type="submit"
                      mix={css({
                        border: 0,
                        background: "transparent",
                        color: "#ffb4a8",
                        cursor: "pointer",
                        font: "inherit",
                        textDecoration: "underline",
                      })}
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </Document>
  );
}

export function AccountPage(
  h: Handle<{
    user: User;
    pendingInvites: DeviceInvite[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { pendingInvites, error, notice } = h.props;
  return () => (
    <Document title="Account · Books Store">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <a href="/app" mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}>
            ← Dashboard
          </a>
          <form method="POST" action="/logout">
            <button type="submit" mix={button({ secondary: true })}>
              Sign out
            </button>
          </form>
        </nav>
        <section mix={css({ maxWidth: "560px", padding: "48px 0" })}>
          <p mix={brandMark}>Account</p>
          <h1 mix={displayTitle}>Devices</h1>
          <p mix={css(muted)}>
            Link another device with a one-time invite. Passkeys stay on each device.
          </p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
          <form method="POST" action="/account" mix={css({ marginTop: "20px" })}>
            <input type="hidden" name="intent" value="create-device-invite" />
            <button type="submit" mix={button()}>
              Create device invite
            </button>
          </form>
          {pendingInvites.length > 0 ? (
            <ul mix={css({ listStyle: "none", margin: "24px 0 0", padding: 0 })}>
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  mix={css({
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    padding: "12px 0",
                    borderTop: "1px solid #4a4036",
                  })}
                >
                  <code mix={css({ color: "#c4b5a0", fontSize: "13px" })}>/invite/{invite.id}</code>
                  <form method="POST" action="/account">
                    <input type="hidden" name="intent" value="revoke-device-invite" />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      mix={css({
                        border: 0,
                        background: "transparent",
                        color: "#ffb4a8",
                        cursor: "pointer",
                        font: "inherit",
                        textDecoration: "underline",
                      })}
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </Document>
  );
}

export function SharePage(
  h: Handle<{
    shareId: string;
    books: Book[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { shareId, books, error, notice } = h.props;
  return () => (
    <Document title="Shared list · Books Store">
      <main mix={shell}>
        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Shared list</p>
          <h1 mix={displayTitle}>Books you can receive</h1>
          <p mix={css(muted)}>
            This link is view-only. You can mark a book as received; you cannot add or edit entries.
          </p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>
        {books.length === 0 ? (
          <p mix={css(muted)}>This list is empty for now.</p>
        ) : (
          <ul
            mix={css({
              listStyle: "none",
              margin: 0,
              padding: "0 0 64px",
              maxWidth: "720px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            })}
          >
            {books.map((book) => (
              <li
                key={book.id}
                mix={css({
                  display: "grid",
                  gridTemplateColumns: "minmax(96px, 140px) 1fr",
                  gap: "18px",
                  padding: "18px",
                  background: "#261f1a",
                  border: "1px solid #4a4036",
                  borderRadius: "18px",
                  "@media (max-width: 560px)": { gridTemplateColumns: "1fr" },
                })}
              >
                <img
                  src={`/books/${book.id}/image?share=${encodeURIComponent(shareId)}`}
                  alt=""
                  mix={css({
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "cover",
                    borderRadius: "12px",
                    background: "#141210",
                  })}
                />
                <div>
                  <p mix={css({ margin: "0 0 12px", whiteSpace: "pre-wrap" })}>
                    {book.description}
                  </p>
                  {book.receivedAt ? (
                    <p mix={css({ color: "#b8d4a8", margin: 0 })}>
                      Received {formatReceived(book.receivedAt)}
                    </p>
                  ) : (
                    <form method="POST" action={`/share/${shareId}`}>
                      <input type="hidden" name="intent" value="mark-received" />
                      <input type="hidden" name="bookId" value={book.id} />
                      <button type="submit" mix={button()}>
                        I've received that book
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Document>
  );
}
