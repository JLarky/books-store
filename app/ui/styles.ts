import { css } from "remix/ui";

export const shell = css({
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "28px clamp(20px, 5vw, 72px)",
  background:
    "radial-gradient(ellipse at 12% 0%, #3d4f3f 0%, transparent 42%), radial-gradient(ellipse at 90% 10%, #4a3f2e 0%, transparent 36%), #1c1917",
  color: "#f5f0e8",
  fontFamily: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  lineHeight: 1.5,
  "& input:not([type=checkbox]):not([type=file]), & select, & textarea": {
    width: "100%",
    minHeight: "46px",
    boxSizing: "border-box",
    border: "1px solid #5c5348",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#141210",
    color: "#f5f0e8",
    font: "inherit",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    "&:focus": { borderColor: "#c4b5a0", boxShadow: "0 0 0 3px #c4b5a033" },
  },
  "& textarea": { minHeight: "96px", resize: "vertical" },
  "& input[type=file]": {
    width: "100%",
    color: "#c4b5a0",
    font: "inherit",
    fontSize: "14px",
  },
  "& input[type=checkbox]": { accentColor: "#c4b5a0", width: "16px", height: "16px" },
  "& form > label": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#d8d0c4",
    fontSize: "14px",
  },
  "& button:disabled": { opacity: 0.5, cursor: "not-allowed" },
});

export const muted = { color: "#a89f90", lineHeight: 1.6 };

export function button(options?: { secondary?: boolean }) {
  return css({
    display: "inline-block",
    appearance: "none",
    border: options?.secondary ? "1px solid #5c5348" : "none",
    borderRadius: "999px",
    padding: "12px 18px",
    marginTop: "8px",
    background: options?.secondary ? "transparent" : "#c4b5a0",
    color: options?.secondary ? "#f5f0e8" : "#1c1917",
    font: "inherit",
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    transition: "transform 150ms ease, background 150ms ease, border-color 150ms ease",
    "&:hover": { transform: "translateY(-1px)" },
  });
}

export const brandMark = css({
  color: "#c4b5a0",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontSize: "12px",
});

export const displayTitle = css({
  fontFamily: "Fraunces, Georgia, serif",
  fontSize: "clamp(36px, 6vw, 56px)",
  lineHeight: 1.08,
  letterSpacing: "-.02em",
  margin: "12px 0",
});
