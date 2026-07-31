import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { Book } from "../data/books.ts";
import { categoryCopyProgress } from "../data/books.ts";
import type { Category, CategoryKind } from "../data/categories.ts";
import { Document } from "./document.tsx";
import { ShareCategoryBooks } from "./share-category-books.tsx";
import { button, muted, shell, brandMark, displayTitle } from "./styles.ts";

function categoryProgressRu(books: Book[], isSend: boolean): string | null {
  const { receivedCount, totalCount, allReceived } = categoryCopyProgress(books);
  if (totalCount === 0) return null;
  if (allReceived) return isSend ? "Все отправлены" : "Все получены";
  return isSend
    ? `${receivedCount}/${totalCount} отправлено`
    : `${receivedCount}/${totalCount} получено`;
}

function ShareSignOut(_h: Handle) {
  return () => (
    <form method="POST" action="/logout">
      <button type="submit" mix={button({ secondary: true })}>
        Выйти
      </button>
    </form>
  );
}

export function ShareFlowChooserPage(
  h: Handle<{
    shareId: string;
    error: string | null;
  }>,
) {
  const { shareId, error } = h.props;
  return () => (
    <Document title="Книги · Books Store" lang="ru">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "flex-end", marginBottom: "8px" })}>
          <ShareSignOut />
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "48px 0 24px" })}>
          <p mix={brandMark}>Общий список</p>
          <h1 mix={displayTitle}>Что вы хотите сделать?</h1>
          <p mix={css(muted)}>Сначала выберите: получить книги или отправить.</p>
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
        </section>
        <div
          mix={css({
            maxWidth: "720px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginBottom: "64px",
          })}
        >
          <a href={`/share/${shareId}?kind=receive`} mix={button()}>
            Получить
          </a>
          <a href={`/share/${shareId}?kind=send`} mix={button({ secondary: true })}>
            Отправить
          </a>
        </div>
      </main>
    </Document>
  );
}

export function ShareCategoriesPage(
  h: Handle<{
    shareId: string;
    kind: CategoryKind;
    categories: Array<{ category: Category; books: Book[] }>;
    error: string | null;
  }>,
) {
  const { shareId, kind, categories, error } = h.props;
  const isSend = kind === "send";
  const title = isSend ? "Категории для отправки" : "Категории для получения";
  return () => (
    <Document title={`${title} · Books Store`} lang="ru">
      <main mix={shell}>
        <nav
          mix={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          })}
        >
          <a
            href={`/share/${shareId}`}
            mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}
          >
            ← Получить / Отправить
          </a>
          <ShareSignOut />
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "32px 0 24px" })}>
          <p mix={brandMark}>Общий список</p>
          <h1 mix={displayTitle}>{title}</h1>
          <p mix={css(muted)}>
            Выберите категорию, чтобы посмотреть книги. Вы можете отметить, что книгу уже{" "}
            {isSend ? "отправили" : "получили"}. Добавлять и редактировать книги нельзя.
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
            {categories.map(({ category, books }) => {
              const progress = categoryProgressRu(books, isSend);
              return (
                <li key={category.id}>
                  <a
                    href={`/share/${shareId}/categories/${category.id}?kind=${kind}`}
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
                    {progress ? (
                      <span
                        mix={css({
                          display: "block",
                          color: progress.startsWith("Все") ? "#b8d4a8" : "#c4b5a0",
                          fontWeight: 700,
                          marginBottom: "8px",
                        })}
                      >
                        {progress}
                      </span>
                    ) : null}
                    {category.description ? (
                      <span mix={css({ ...muted, whiteSpace: "pre-wrap" })}>
                        {category.description}
                      </span>
                    ) : (
                      <span mix={css(muted)}>Без описания</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </Document>
  );
}

export function ShareCategoryPage(
  h: Handle<{
    shareId: string;
    kind: CategoryKind;
    category: Category;
    books: Book[];
    error: string | null;
    notice: string | null;
  }>,
) {
  const { shareId, kind, category, books, error, notice } = h.props;
  const isSend = kind === "send" || category.kind === "send";
  const backHref = `/share/${shareId}?kind=${kind}`;
  const action = `/share/${shareId}/categories/${category.id}?kind=${kind}`;
  return () => (
    <Document title={`${category.name} · Books Store`} lang="ru">
      <main mix={shell}>
        <nav
          mix={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          })}
        >
          <a
            href={backHref}
            mix={css({ color: "#c4b5a0", textDecoration: "none", fontWeight: 700 })}
          >
            ← Все категории
          </a>
          <ShareSignOut />
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
        <ShareCategoryBooks
          shareId={shareId}
          action={action}
          isSend={isSend}
          books={books.map((book) => ({
            id: book.id,
            description: book.description,
            twoCopies: book.twoCopies,
            receivedAt: book.receivedAt,
            imageByteLength: book.imageByteLength,
          }))}
          allDoneMessage={isSend ? "Все книги отправлены" : "Все книги получены"}
        />
      </main>
    </Document>
  );
}
