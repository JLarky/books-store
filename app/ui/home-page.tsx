import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { shell, button, muted, brandMark, displayTitle } from "./styles.ts";

export function HomePage(h: Handle<{ signedIn: boolean; shareId: string | null }>) {
  const { signedIn, shareId } = h.props;
  return () => (
    <Document title="Books Store" lang="ru">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <strong mix={css({ fontFamily: "Fraunces, Georgia, serif", fontSize: "22px" })}>
            Books Store
          </strong>
          <a href={signedIn ? "/app" : "/login"} mix={button({ secondary: true })}>
            {signedIn ? "Открыть кабинет" : "Войти"}
          </a>
        </nav>
        <section mix={css({ maxWidth: "640px", padding: "96px 0 120px" })}>
          <p mix={brandMark}>Общие списки книг</p>
          <h1 mix={displayTitle}>Список книг, которыми вы хотите поделиться.</h1>
          <p mix={css({ ...muted, fontSize: "20px", maxWidth: "520px" })}>
            Загружайте обложки, добавляйте короткие заметки и отправляйте ссылку — по ней можно
            смотреть книги и отмечать, что уже получили.
          </p>
          {shareId && !signedIn ? (
            <div mix={css({ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" })}>
              <a href={`/share/${shareId}`} mix={button({})}>
                Продолжить общий список →
              </a>
              <form method="POST" action="/logout">
                <button type="submit" mix={button({ secondary: true })}>
                  Выйти
                </button>
              </form>
            </div>
          ) : (
            <a href={signedIn ? "/app" : "/login"} mix={button({})}>
              {signedIn ? "Открыть ваш список →" : "Начать с ключа доступа →"}
            </a>
          )}
        </section>
      </main>
    </Document>
  );
}
