import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";
import type { Book } from "../data/books.ts";
import type { Category } from "../data/categories.ts";
import { BookImageFields } from "./book-image-fields.tsx";
import { ConfirmDeleteForm } from "./confirm-delete-form.tsx";
import { button, muted } from "./styles.ts";

function categoryPicker(categories: Category[], selectedIds: string[]): RemixNode {
  const selected = new Set(selectedIds);
  const summary = categories.map((category) => category.name).join(" · ");

  return (
    <details
      mix={css({
        margin: 0,
        padding: "12px 14px",
        border: "1px solid #5c5348",
        borderRadius: "12px",
      })}
    >
      <summary
        mix={css({
          cursor: "pointer",
          color: "#d8d0c4",
          fontSize: "14px",
          listStyle: "none",
          "&::-webkit-details-marker": { display: "none" },
          "&::before": {
            content: '"▸ "',
            display: "inline",
          },
          "details[open] > &::before": { content: '"▾ "' },
        })}
      >
        {summary}
      </summary>
      <div
        mix={css({
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "10px",
        })}
      >
        {categories.map((category) => (
          <label
            key={category.id}
            mix={css({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "9px",
              fontSize: "14px",
            })}
          >
            <input
              type="checkbox"
              name="categoryIds"
              value={category.id}
              checked={selected.has(category.id) ? true : undefined}
            />
            {category.name}
          </label>
        ))}
      </div>
    </details>
  );
}

export function BookUploadForm(
  h: Handle<{
    action: string;
    categories: Category[];
    selectedCategoryIds?: string[];
    lockedCategoryId?: string;
  }>,
) {
  const { action, categories, selectedCategoryIds = [], lockedCategoryId } = h.props;
  const selected = new Set(selectedCategoryIds);
  if (lockedCategoryId) selected.add(lockedCategoryId);
  const choosable = categories.filter((category) => category.id !== lockedCategoryId);

  return () => (
    <form
      method="POST"
      action={action}
      encType="multipart/form-data"
      mix={css({ display: "flex", flexDirection: "column", gap: "14px" })}
    >
      <input type="hidden" name="intent" value="add-book" />
      {lockedCategoryId ? (
        <input type="hidden" name="categoryIds" value={lockedCategoryId} />
      ) : null}
      <BookImageFields imageRequired />
      {choosable.length > 0 ? (
        categoryPicker(choosable, [...selected])
      ) : lockedCategoryId ? (
        <p mix={css({ ...muted, margin: 0, fontSize: "14px" })}>
          This book will be added to the current category.
        </p>
      ) : (
        <p mix={css({ ...muted, margin: 0, fontSize: "14px" })}>
          Create a category first if you want to group this book.
        </p>
      )}
      <button type="submit" mix={button()}>
        Add book
      </button>
    </form>
  );
}

function formatReceived(iso: string, locale?: string) {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OwnerBookList(
  h: Handle<{
    books: Book[];
    categories: Category[];
    action: string;
    emptyMessage?: string;
  }>,
) {
  const { books, categories, action, emptyMessage } = h.props;
  const byId = new Map(categories.map((category) => [category.id, category]));

  return () =>
    books.length === 0 ? (
      <p mix={css(muted)}>
        {emptyMessage ?? "No books yet. Add your first cover and description above."}
      </p>
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
              <p mix={css({ margin: "0 0 12px", whiteSpace: "pre-wrap" })}>{book.description}</p>
              <p mix={css({ ...muted, margin: "0 0 12px", fontSize: "14px" })}>
                {book.categoryIds.length === 0
                  ? "No categories"
                  : book.categoryIds
                      .map((id) => byId.get(id)?.name ?? id)
                      .filter(Boolean)
                      .join(" · ")}
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
                action={action}
                encType="multipart/form-data"
                mix={css({ display: "flex", flexDirection: "column", gap: "10px" })}
              >
                <input type="hidden" name="intent" value="update-book" />
                <input type="hidden" name="bookId" value={book.id} />
                <BookImageFields
                  description={book.description}
                  existingImageSrc={`/books/${book.id}/image`}
                />
                {categories.length > 0 ? categoryPicker(categories, book.categoryIds) : null}
                <button type="submit" mix={button({ secondary: true })}>
                  Save book
                </button>
              </form>
              <ConfirmDeleteForm
                action={action}
                message="Delete this book?"
                label="Delete book"
                fields={{ intent: "delete-book", bookId: book.id }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
}

export function panel(children: RemixNode) {
  return (
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
      {children}
    </section>
  );
}
