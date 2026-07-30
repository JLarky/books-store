import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

/** Keep signed-in and share-invite sessions for about a year until explicit sign-out. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const cookie = createCookie("__books_store_session", {
  secrets: [process.env.SESSION_SECRET ?? "books-store-local-session-secret"],
  httpOnly: true,
  sameSite: "Lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});
const storage = createCookieSessionStorage();
export function authSession() {
  return session(cookie, storage);
}
export function devAuthEnabled(): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.DENO_DEPLOYMENT_ID
  );
}

function hostMatches(
  state: { get(key: string): unknown },
  request: Request | undefined,
  hostKey: string,
): boolean {
  if (!request) return true;
  const boundHost = state.get(hostKey);
  return typeof boundHost === "string" && boundHost === new URL(request.url).host;
}

export function userId(state: { get(key: string): unknown }, request?: Request): string | null {
  if (!hostMatches(state, request, "sessionHost")) return null;
  const value = state.get("userId");
  return typeof value === "string" && value ? value : null;
}
export function bindUserSession(
  state: { set(key: string, value: unknown): void },
  request: Request,
  id: string,
): void {
  state.set("userId", id);
  state.set("sessionHost", new URL(request.url).host);
}

export function shareId(state: { get(key: string): unknown }, request?: Request): string | null {
  if (!hostMatches(state, request, "shareSessionHost")) return null;
  const value = state.get("shareId");
  return typeof value === "string" && value ? value : null;
}
export function bindShareSession(
  state: { set(key: string, value: unknown): void },
  request: Request,
  id: string,
): void {
  state.set("shareId", id);
  state.set("shareSessionHost", new URL(request.url).host);
}
export function clearShareSession(state: { unset(key: string): void }): void {
  state.unset("shareId");
  state.unset("shareSessionHost");
}

export type Challenge = {
  kind: "register" | "login" | "invite";
  challenge: string;
  userId?: string;
  inviteId?: string;
};
export function setChallenge(state: { set(k: string, v: unknown): void }, value: Challenge) {
  state.set("challenge", value);
}
export function takeChallenge(state: {
  get(k: string): unknown;
  unset(k: string): void;
}): Challenge | null {
  const value = state.get("challenge");
  state.unset("challenge");
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return (r.kind === "register" || r.kind === "login" || r.kind === "invite") &&
    typeof r.challenge === "string"
    ? {
        kind: r.kind,
        challenge: r.challenge,
        userId: typeof r.userId === "string" ? r.userId : undefined,
        inviteId: typeof r.inviteId === "string" ? r.inviteId : undefined,
      }
    : null;
}
