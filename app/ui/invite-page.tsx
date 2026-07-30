import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { PasskeyButtons } from "./passkey-buttons.tsx";
import { muted, shell, brandMark, displayTitle } from "./styles.ts";

export function InvitePage(
  h: Handle<{ inviteId: string; error: string | null; signedIn?: boolean }>,
) {
  return () => (
    <Document title="Device invite · Books Store">
      <main mix={shell}>
        <section
          mix={css({
            maxWidth: "430px",
            margin: "96px auto",
            padding: "32px",
            background: "#261f1a",
            border: "1px solid #4a4036",
            borderRadius: "24px",
          })}
        >
          <p mix={brandMark}>Device invite</p>
          <h1 mix={displayTitle}>Link this device.</h1>
          <p mix={css(muted)}>
            Create a new passkey on this device and attach it to the same Books Store account.
          </p>
          {h.props.signedIn ? (
            <>
              <p mix={css({ color: "#ffc1b8" })}>
                You are already signed in on this device. Sign out first if this invite is for a
                different device.
              </p>
              <div mix={css({ display: "flex", gap: "12px", flexWrap: "wrap" })}>
                <a href="/app" mix={css({ color: "#c4b5a0" })}>
                  Open dashboard
                </a>
                <form method="POST" action="/logout">
                  <button
                    type="submit"
                    mix={css({
                      border: 0,
                      background: "transparent",
                      color: "#c4b5a0",
                      textDecoration: "underline",
                      cursor: "pointer",
                      font: "inherit",
                    })}
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          ) : h.props.error ? (
            <p mix={css({ color: "#ffc1b8" })}>{h.props.error}</p>
          ) : (
            <PasskeyButtons mode="invite" inviteId={h.props.inviteId} returnTo="/app" />
          )}
          <a
            href="/"
            mix={css({ ...muted, display: "block", marginTop: "24px", fontSize: "13px" })}
          >
            Back home
          </a>
        </section>
      </main>
    </Document>
  );
}
