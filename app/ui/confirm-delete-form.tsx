import { clientEntry, css, on, type Handle } from "remix/ui";
import { button } from "./styles.ts";

export const ConfirmDeleteForm = clientEntry(
  "/app/ui/confirm-delete-form.tsx",
  function ConfirmDeleteForm(
    h: Handle<{
      action: string;
      message: string;
      label: string;
      fields: Record<string, string>;
    }>,
  ) {
    const { action, message, label, fields } = h.props;
    return () => (
      <form
        method="POST"
        action={action}
        mix={[
          css({ marginTop: "8px" }),
          on<HTMLFormElement>("submit", (event) => {
            if (!confirm(message)) event.preventDefault();
          }),
        ]}
      >
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit" mix={button({ secondary: true })}>
          {label}
        </button>
      </form>
    );
  },
);
