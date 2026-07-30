import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { button, muted, shell, brandMark, displayTitle } from "./styles.ts";

export function AccessPage(
  h: Handle<{ destination: string; title: string; detail: string; staleSession?: boolean }>,
) {
  const { destination, title, detail, staleSession } = h.props;
  return () => (
    <Document title={`${title} · Books Store`}>
      <main mix={shell}>
        <section
          mix={css({
            maxWidth: "480px",
            margin: "96px auto",
            padding: "32px",
            background: "#261f1a",
            border: "1px solid #4a4036",
            borderRadius: "24px",
          })}
        >
          <p mix={brandMark}>Books Store</p>
          <h1 mix={displayTitle}>{title}</h1>
          <p mix={css(muted)}>{detail}</p>
          <div mix={css({ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" })}>
            <a href={`/login?returnTo=${encodeURIComponent(destination)}`} mix={button()}>
              Go to sign in
            </a>
            <a href="/" mix={button({ secondary: true })}>
              Back home
            </a>
          </div>
          {staleSession ? (
            <form method="POST" action="/logout" mix={css({ marginTop: "12px" })}>
              <button type="submit" mix={button({ secondary: true })}>
                Sign out this session
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </Document>
  );
}
