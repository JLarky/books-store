import { clientEntry, css, on, type Handle } from "remix/ui";
import { button } from "./styles.ts";

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

export const MarkReceivedForm = clientEntry(
  "/app/ui/mark-received-form.tsx",
  function MarkReceivedForm(
    h: Handle<{
      action: string;
      bookId: string;
      label: string;
      allDoneMessage: string;
    }>,
  ) {
    const { action, bookId, label, allDoneMessage } = h.props;
    let busy = false;
    let error: string | null = null;
    let celebrate = false;

    async function submit(event: Event) {
      event.preventDefault();
      if (busy) return;
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;

      busy = true;
      error = null;
      void h.update();

      try {
        const response = await fetch(action, {
          method: "POST",
          body: new FormData(form),
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string | null;
          allReceived?: boolean;
        };
        if (!response.ok || !data.ok) {
          error = data.error || "Не удалось сохранить отметку";
          busy = false;
          void h.update();
          return;
        }

        if (data.allReceived) {
          celebrate = true;
          void h.update();
          await sleep(2200);
        }

        window.location.reload();
      } catch {
        error = "Не удалось сохранить отметку";
        busy = false;
        void h.update();
      }
    }

    return () => (
      <>
        <form
          method="POST"
          action={action}
          mix={[
            css({ margin: 0 }),
            on<HTMLFormElement>("submit", (event) => {
              void submit(event);
            }),
          ]}
        >
          <input type="hidden" name="intent" value="mark-received" />
          <input type="hidden" name="bookId" value={bookId} />
          <button type="submit" disabled={busy} mix={button()}>
            {busy ? (
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
            ) : (
              label
            )}
          </button>
          {error ? <p mix={css({ color: "#ffb4a8", margin: "8px 0 0" })}>{error}</p> : null}
        </form>
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
  },
);
