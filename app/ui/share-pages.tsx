import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { Book } from "../data/books.ts";
import type { Category } from "../data/categories.ts";
import { ConfirmDeleteForm } from "./confirm-delete-form.tsx";
import { Document } from "./document.tsx";
import { button, muted, shell, brandMark, displayTitle } from "./styles.ts";

function formatReceivedRu(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ShareCategoriesPage(
  h: Handle<{
    shareId: string;
    categories: Category[];
    error: string | null;
  }>,
) {
  const { shareId, categories, error } = h.props;
  return () => (
    <Document title="Категории · Books Store" lang="ru">
      <main mix={shell}>
        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Общий список</p>
          <h1 mix={displayTitle}>Категории книг</h1>
          <p mix={css(muted)}>
            Выберите категорию, чтобы посмотреть книги. Вы можете отметить, что книгу уже получили.
            Добавлять и редактировать книги нельзя.
          </p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
        </section>
        {categories.length === 0 ? (
          <p mix={css(muted)}>Пока нет ни одной категории.</p>
        ) : (
          <ul
            mix={css({
              listStyle: "none",
              margin: 0,
              padding: "0 0 64px",
              maxWidth: "720px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            })}
          >
            {categories.map((category) => (
              <li key={category.id}>
                <a
                  href={`/share/${shareId}/categories/${category.id}`}
                  mix={css({
                    display: "block",
                    padding: "18px",
                    background: "#261f1a",
                    border: "1px solid #4a4036",
                    borderRadius: "18px",
                    color: "#f5f0e8",
                    textDecoration: "none",
                  })}
                >
                  <strong
                    mix={css({
                      display: "block",
                      fontFamily: "Fraunces, Georgia, serif",
                      fontSize: "22px",
                      marginBottom: "6px",
                    })}
                  >
                    {category.name}
                  </strong>
                  {category.description ? (
                    <span mix={css({ ...muted, whiteSpace: "pre-wrap" })}>
                      {category.description}
                    </span>
                  ) : (
                    <span mix={css(muted)}>Без описания</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Document>
  );
}

export function ShareCategoryPage(
  h: Handle<{
    shareId: string;
    category: Category;
    books: Book[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { shareId, category, books, error, notice } = h.props;
  return () => (
    <Document title={`${category.name} · Books Store`} lang="ru">
      <main mix={shell}>
        <nav mix={css({ marginBottom: "8px" })}>
          <a
            href={`/share/${shareId}`}
            mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}
          >
            ← Все категории
          </a>
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "32px 0 24px" })}>
          <p mix={brandMark}>Категория</p>
          <h1 mix={displayTitle}>{category.name}</h1>
          {category.description ? (
            <p mix={css({ ...muted, whiteSpace: "pre-wrap" })}>{category.description}</p>
          ) : null}
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
          {notice ? <p mix={css({ color: "#b8d4a8" })}>{notice}</p> : null}
        </section>
        {books.length === 0 ? (
          <p mix={css(muted)}>В этой категории пока нет книг.</p>
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
                    <div>
                      <p mix={css({ color: "#b8d4a8", margin: 0 })}>
                        Получено: {formatReceivedRu(book.receivedAt)}
                      </p>
                      <ConfirmDeleteForm
                        action={`/share/${shareId}/categories/${category.id}`}
                        message="Снять отметку о получении этой книги?"
                        label="Ой, на самом деле нет"
                        fields={{ intent: "unmark-received", bookId: book.id }}
                      />
                    </div>
                  ) : (
                    <form method="POST" action={`/share/${shareId}/categories/${category.id}`}>
                      <input type="hidden" name="intent" value="mark-received" />
                      <input type="hidden" name="bookId" value={book.id} />
                      <button type="submit" mix={button()}>
                        Я получил(а) эту книгу
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
