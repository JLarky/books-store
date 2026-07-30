import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { Book, ShareInvite } from "../data/books.ts";
import type { Category } from "../data/categories.ts";
import type { DeviceInvite, User } from "../data/users.ts";
import { BookUploadForm, OwnerBookList, panel } from "./book-form.tsx";
import { ConfirmDeleteForm } from "./confirm-delete-form.tsx";
import { Document } from "./document.tsx";
import { JsonBackup } from "./json-backup.tsx";
import { button, muted, shell, brandMark, displayTitle } from "./styles.ts";

export function DashboardPage(
  h: Handle<{
    user: User;
    books: Book[];
    categories: Category[];
    shareInvites: ShareInvite[];
    backupJson: string;
    error: string | null;
    notice: string | null;
  }>,
) {
  const { books, categories, shareInvites, backupJson, error, notice } = h.props;
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
            <a href="/app/categories" mix={button({ secondary: true })}>
              Categories
            </a>
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
            Manage categories to add books, then create a share link so others can browse by
            category and mark books as received.
          </p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>

        {books.length > 0 ? (
          <section mix={css({ maxWidth: "720px", marginBottom: "48px" })}>
            <h2 mix={css({ fontFamily: "Fraunces, Georgia, serif" })}>Uncategorized books</h2>
            <p mix={css({ ...muted, marginTop: 0 })}>
              These books are not in any category yet. Assign categories below, or open Categories
              to upload into a category.
            </p>
            <OwnerBookList
              books={books}
              categories={categories}
              action="/app"
              emptyMessage="No uncategorized books."
            />
          </section>
        ) : null}

        {panel(
          <>
            <h2 mix={css({ margin: "0 0 8px", fontFamily: "Fraunces, Georgia, serif" })}>
              Share links
            </h2>
            <p mix={css({ ...muted, marginTop: 0 })}>
              Anyone with a share link can browse categories and press “I’ve received that book.”
              They cannot add or edit books.
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
                    <code mix={css({ color: "#c4b5a0", fontSize: "13px" })}>
                      /share/{invite.id}
                    </code>
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
          </>,
        )}

        <JsonBackup jsonContent={backupJson} />
      </main>
    </Document>
  );
}

export function CategoriesPage(
  h: Handle<{
    categories: Category[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { categories, error, notice } = h.props;
  return () => (
    <Document title="Categories · Books Store">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <a href="/app" mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}>
            ← Dashboard
          </a>
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Organize</p>
          <h1 mix={displayTitle}>Categories</h1>
          <p mix={css(muted)}>Create categories, then open one to upload books directly into it.</p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>

        {panel(
          <>
            <h2 mix={css({ margin: "0 0 16px", fontFamily: "Fraunces, Georgia, serif" })}>
              New category
            </h2>
            <form
              method="POST"
              action="/app/categories"
              mix={css({ display: "flex", flexDirection: "column", gap: "14px" })}
            >
              <input type="hidden" name="intent" value="create-category" />
              <label>
                Name
                <input type="text" name="name" required placeholder="Fiction, kids, gifts…" />
              </label>
              <label>
                Description
                <textarea name="description" placeholder="What belongs in this category?" />
              </label>
              <button type="submit" mix={button()}>
                Create category
              </button>
            </form>
          </>,
        )}

        <section mix={css({ maxWidth: "720px", marginBottom: "64px" })}>
          <h2 mix={css({ fontFamily: "Fraunces, Georgia, serif" })}>Your categories</h2>
          {categories.length === 0 ? (
            <p mix={css(muted)}>No categories yet.</p>
          ) : (
            <ul
              mix={css({
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              })}
            >
              {categories.map((category) => (
                <li
                  key={category.id}
                  mix={css({
                    padding: "18px",
                    background: "#261f1a",
                    border: "1px solid #4a4036",
                    borderRadius: "18px",
                  })}
                >
                  <a
                    href={`/app/categories/${category.id}`}
                    mix={css({
                      color: "#f5f0e8",
                      textDecoration: "none",
                      fontFamily: "Fraunces, Georgia, serif",
                      fontSize: "22px",
                      fontWeight: 700,
                    })}
                  >
                    {category.name}
                  </a>
                  {category.description ? (
                    <p mix={css({ ...muted, margin: "8px 0 14px", whiteSpace: "pre-wrap" })}>
                      {category.description}
                    </p>
                  ) : (
                    <p mix={css({ ...muted, margin: "8px 0 14px" })}>No description</p>
                  )}
                  <form
                    method="POST"
                    action="/app/categories"
                    mix={css({ display: "flex", flexDirection: "column", gap: "10px" })}
                  >
                    <input type="hidden" name="intent" value="update-category" />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <label>
                      Name
                      <input type="text" name="name" value={category.name} required />
                    </label>
                    <label>
                      Description
                      <textarea name="description" value={category.description} />
                    </label>
                    <div mix={css({ display: "flex", gap: "10px", flexWrap: "wrap" })}>
                      <button type="submit" mix={button({ secondary: true })}>
                        Save
                      </button>
                      <a href={`/app/categories/${category.id}`} mix={button({ secondary: true })}>
                        Open
                      </a>
                    </div>
                  </form>
                  <ConfirmDeleteForm
                    action="/app/categories"
                    message="Delete this category?"
                    label="Delete category"
                    fields={{ intent: "delete-category", categoryId: category.id }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </Document>
  );
}

export function CategoryDetailPage(
  h: Handle<{
    category: Category;
    books: Book[];
    categories: Category[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { category, books, categories, error, notice } = h.props;
  const action = `/app/categories/${category.id}`;
  return () => (
    <Document title={`${category.name} · Books Store`}>
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <a
            href="/app/categories"
            mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}
          >
            ← Categories
          </a>
          <a href="/app" mix={button({ secondary: true })}>
            Dashboard
          </a>
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Category</p>
          <h1 mix={displayTitle}>{category.name}</h1>
          {category.description ? (
            <p mix={css({ ...muted, whiteSpace: "pre-wrap" })}>{category.description}</p>
          ) : null}
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>

        {panel(
          <>
            <h2 mix={css({ margin: "0 0 16px", fontFamily: "Fraunces, Georgia, serif" })}>
              Add a book to this category
            </h2>
            <BookUploadForm
              action={action}
              categories={categories}
              lockedCategoryId={category.id}
              selectedCategoryIds={[category.id]}
            />
          </>,
        )}

        <section mix={css({ maxWidth: "720px", marginBottom: "64px" })}>
          <h2 mix={css({ fontFamily: "Fraunces, Georgia, serif" })}>Books in this category</h2>
          <OwnerBookList
            books={books}
            categories={categories}
            action={action}
            emptyMessage="No books in this category yet."
          />
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
