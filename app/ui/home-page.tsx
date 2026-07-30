import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { shell, button, muted, brandMark, displayTitle } from "./styles.ts";

export function HomePage(h: Handle<{ signedIn: boolean; shareId: string | null }>) {
  const { signedIn, shareId } = h.props;
  return () => (
    <Document title="Books Store">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <strong mix={css({ fontFamily: "Fraunces, Georgia, serif", fontSize: "22px" })}>
            Books Store
          </strong>
          <a href={signedIn ? "/app" : "/login"} mix={button({ secondary: true })}>
            {signedIn ? "Open dashboard" : "Sign in"}
          </a>
        </nav>
        <section mix={css({ maxWidth: "640px", padding: "96px 0 120px" })}>
          <p mix={brandMark}>Shared reading lists</p>
          <h1 mix={displayTitle}>Keep a list of books you want to share.</h1>
          <p mix={css({ ...muted, fontSize: "20px", maxWidth: "520px" })}>
            Upload covers, add short notes, and send a link so others can browse — and mark when
            they have received each book.
          </p>
          {shareId && !signedIn ? (
            <div mix={css({ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" })}>
              <a href={`/share/${shareId}`} mix={button({})}>
                Continue shared list →
              </a>
              <form method="POST" action="/logout">
                <button type="submit" mix={button({ secondary: true })}>
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <a href={signedIn ? "/app" : "/login"} mix={button({})}>
              {signedIn ? "Open your list →" : "Get started with a passkey →"}
            </a>
          )}
        </section>
      </main>
    </Document>
  );
}
