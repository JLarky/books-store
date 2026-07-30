# Books Store

Shared book list app, built from the same Remix/Vite foundation as `../finance-planner` and `../llm-usage`.

## Stack

- Remix 3 with Vite and Nitro SSR
- Passkey authentication via SimpleWebAuthn
- Deno KV in Deno Deploy
- Local JSON fallback during Node development

## V1 features

- Owner dashboard: upload a cover image and text description for each book
- Share invite links: anyone with the link can view the list
- Viewers cannot add books or edit descriptions
- “I've received that book” saves the received timestamp in the database

## Local development

```sh
pnpm install
cp .env.example .env
# Optional local auth shortcut:
# echo 'DEV_AUTH_BYPASS=1' >> .env
pnpm dev
```

`/` is public, `/health` checks storage connectivity, `/login` creates or authenticates a passkey, and `/app` is the owner dashboard. Share links live at `/share/:shareId`.

During Node development, the local fallback is a JSON file rather than a real database. By default it is `data/app-store.local.json`, relative to the worktree, and is ignored by git. Set `BOOKS_STORE_DATA_PATH` to a unique path when running more than one server from the same worktree. Deno deployments use the KV database selected by `DENO_KV_URL` instead. Books Store stores all managed KV records below the `books-store` key namespace so it can share a production database with other applications without colliding with their records.

## Deno Deploy

1. Create or link a Deno Deploy app to this repository.
2. Link a Deno KV database to the app.
3. Set `SESSION_SECRET` in the Deploy environment.
4. Build with `NITRO_PRESET=deno_deploy pnpm build` (Nitro's `deno_deploy` preset).
5. Deploy `.output/server/index.ts` with `deployctl`, or configure the Deno Deploy GitHub integration to run the same build.

On Deno Deploy, the runtime adapter calls `Deno.openKv()` automatically. Set `DENO_KV_URL` only when using a specific remote KV database during development.

Passkeys are bound to the exact hostname, so register and sign in from the same deployed hostname.
Session cookies are host-only and also bind their signed user session to the exact hostname that
created it.
