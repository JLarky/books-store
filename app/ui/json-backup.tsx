import { clientEntry, css, on, type Handle } from "remix/ui";
import { button, muted } from "./styles.ts";

export const JsonBackup = clientEntry(
  "/app/ui/json-backup.tsx",
  function JsonBackup(h: Handle<{ jsonContent: string }>) {
    let status = "";

    async function copy(content: string, successMessage: string) {
      try {
        await navigator.clipboard.writeText(content);
        status = successMessage;
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        status = copied ? successMessage : "Copy failed. Select the text below.";
      }
      void h.update();
    }

    function download(content: string, filename: string, type: string) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      status = `Downloaded ${filename}.`;
      void h.update();
    }

    return () => (
      <section
        mix={css({
          marginTop: "32px",
          paddingTop: "16px",
          maxWidth: "720px",
          marginBottom: "64px",
        })}
        data-backup-section
      >
        <p
          mix={css({
            color: "#c4b5a0",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "12px",
          })}
        >
          Take it with you
        </p>
        <h2
          mix={css({
            margin: "10px 0 8px",
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: "28px",
          })}
        >
          JSON backup
        </h2>
        <p mix={css({ ...muted, maxWidth: "720px" })}>
          Download or copy a snapshot of your categories, books, and cover images. Import will come
          later — keep this file somewhere safe.
        </p>
        <div mix={css({ display: "flex", flexWrap: "wrap", gap: "10px" })}>
          <button
            type="button"
            mix={[
              button({}),
              on("click", () => void copy(h.props.jsonContent, "Copied JSON backup.")),
            ]}
            data-copy-json
          >
            Copy JSON
          </button>
          <button
            type="button"
            mix={[
              button({ secondary: true }),
              on("click", () =>
                download(
                  h.props.jsonContent,
                  "books-store-backup.json",
                  "application/json;charset=utf-8",
                ),
              ),
            ]}
            data-download-json
          >
            Download JSON backup
          </button>
        </div>
        {status ? (
          <p role="status" mix={css({ color: "#b8d4a8", marginBottom: 0 })}>
            {status}
          </p>
        ) : null}
        <details mix={css({ marginTop: "20px" })}>
          <summary mix={css({ cursor: "pointer", color: "#c4b5a0" })}>Preview JSON backup</summary>
          <textarea
            readOnly
            value={h.props.jsonContent}
            aria-label="JSON backup preview"
            mix={css({
              width: "100%",
              minHeight: "180px",
              marginTop: "12px",
              boxSizing: "border-box",
              background: "#141210",
              color: "#d8d0c4",
              border: "1px solid #5c5348",
              borderRadius: "10px",
              padding: "12px",
              font: "13px ui-monospace, SFMono-Regular, Menlo, monospace",
            })}
          />
        </details>
      </section>
    );
  },
);
