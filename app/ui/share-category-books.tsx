import { clientEntry, css, on, type Handle } from "remix/ui";
import type { Book } from "../data/books.ts";
import { button, muted } from "./styles.ts";

type ShareBook = Pick<Book, "id" | "description" | "twoCopies" | "receivedAt" | "imageByteLength">;

const overlay = css({
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "rgba(12, 10, 8, 0.72)",
  color: "#f5f0e8",
  textAlign: "center",
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bookCopyCount(book: Pick<ShareBook, "twoCopies">): number {
  return book.twoCopies ? 2 : 1;
}

function categoryProgressRu(books: ShareBook[], isSend: boolean): string | null {
  let receivedCount = 0;
  let totalCount = 0;
  for (const book of books) {
    const copies = bookCopyCount(book);
    totalCount += copies;
    if (book.receivedAt) receivedCount += copies;
  }
  if (totalCount === 0) return null;
  if (receivedCount === totalCount) return isSend ? "Все отправлены" : "Все получены";
  return isSend
    ? `${receivedCount}/${totalCount} отправлено`
    : `${receivedCount}/${totalCount} получено`;
}

function formatReceivedRu(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function spinnerLabel(idle: string, busy: boolean) {
  if (!busy) return idle;
  return (
    <>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        aria-hidden="true"
        mix={css({
          display: "inline-block",
          marginRight: "8px",
          verticalAlign: "-2px",
        })}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="#1c191755" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="#1c1917"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      Сохранение…
    </>
  );
}

export const ShareCategoryBooks = clientEntry(
  "/app/ui/share-category-books.tsx",
  function ShareCategoryBooks(
    h: Handle<{
      shareId: string;
      action: string;
      isSend: boolean;
      books: ShareBook[];
      allDoneMessage: string;
    }>,
  ) {
    const { shareId, action, isSend, allDoneMessage } = h.props;
    let books: ShareBook[] = h.props.books.map((book) => ({ ...book }));
    let busyBookId: string | null = null;
    let error: string | null = null;
    let celebrate = false;

    async function postIntent(intent: "mark-received" | "unmark-received", bookId: string) {
      if (busyBookId) return;
      busyBookId = bookId;
      error = null;
      void h.update();

      try {
        const body = new FormData();
        body.set("intent", intent);
        body.set("bookId", bookId);
        const response = await fetch(action, {
          method: "POST",
          body,
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string | null;
          allReceived?: boolean;
          receivedAt?: string | null;
        };
        if (!response.ok || !data.ok) {
          error = data.error || "Не удалось изменить отметку";
          busyBookId = null;
          void h.update();
          return;
        }

        books = books.map((book) =>
          book.id === bookId
            ? {
                ...book,
                receivedAt:
                  intent === "mark-received" ? (data.receivedAt ?? new Date().toISOString()) : null,
              }
            : book,
        );

        if (intent === "mark-received" && data.allReceived) {
          celebrate = true;
          busyBookId = null;
          void h.update();
          await sleep(2200);
          celebrate = false;
        }

        busyBookId = null;
        void h.update();
      } catch {
        error = "Не удалось изменить отметку";
        busyBookId = null;
        void h.update();
      }
    }

    return () => {
      const progress = categoryProgressRu(books, isSend);
      return (
        <>
          {progress ? (
            <p
              mix={css({
                color: progress.startsWith("Все") ? "#b8d4a8" : "#c4b5a0",
                fontWeight: 700,
                margin: "12px 0 0",
              })}
            >
              {progress}
            </p>
          ) : null}
          {error ? <p mix={css({ color: "#ffb4a8" })}>{error}</p> : null}
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
              {books.map((book) => {
                const busy = busyBookId === book.id;
                const markLabel = isSend
                  ? "Я отправил(а) эту книгу"
                  : book.twoCopies
                    ? "Я получила книги --- 2 штуки"
                    : "Я получил(а) эту книгу";
                return (
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
                      {book.twoCopies ? (
                        <p mix={css({ ...muted, margin: "0 0 12px", fontSize: "14px" })}>2 штуки</p>
                      ) : null}
                      {book.receivedAt ? (
                        <div>
                          <p mix={css({ color: "#b8d4a8", margin: 0 })}>
                            {isSend ? "Отправлено" : "Получено"}:{" "}
                            {formatReceivedRu(book.receivedAt)}
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            mix={[
                              button({ secondary: true }),
                              css({ marginTop: "8px" }),
                              on("click", () => {
                                const message = isSend
                                  ? "Снять отметку об отправке этой книги?"
                                  : "Снять отметку о получении этой книги?";
                                if (!confirm(message)) return;
                                void postIntent("unmark-received", book.id);
                              }),
                            ]}
                          >
                            {spinnerLabel("Ой, на самом деле нет", busy)}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          mix={[
                            button(),
                            on("click", () => {
                              void postIntent("mark-received", book.id);
                            }),
                          ]}
                        >
                          {spinnerLabel(markLabel, busy)}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {celebrate ? (
            <div mix={overlay} role="alertdialog" aria-live="assertive" aria-modal="true">
              <p
                mix={css({
                  margin: 0,
                  maxWidth: "22rem",
                  fontFamily: "Fraunces, Georgia, serif",
                  fontSize: "clamp(28px, 5vw, 40px)",
                  lineHeight: 1.2,
                })}
              >
                {allDoneMessage}
              </p>
            </div>
          ) : null}
        </>
      );
    };
  },
);
