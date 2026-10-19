# Troubleshooting the Development Environment

Common problems when setting up and running Soroban DevConsole locally. Each
entry lists the **symptoms** you see, the **cause**, and the **fix**.

Find your problem by category, or search this page for the exact error text.

- [Setup](#setup)
- [Build](#build)
- [Runtime](#runtime)
- [Database](#database)
- [Network](#network)
- [FAQ](#faq)

Before you dig in, run these checks. They catch most configuration drift:

```bash
node -v                 # expect v20 or later
npm -v                  # expect 10 or later
npm run check-drift     # ports and URLs match packages/api-contracts runtime defaults
npm run check-integrity # lockfile and workspace dependencies are consistent
```

---

## Setup

### 1. `npm install` fails with `EBADENGINE` or syntax errors in dependencies

**Symptoms**

- `npm WARN EBADENGINE Unsupported engine` for `next` or `@nestjs/*`.
- Install succeeds, but `npm run dev` crashes with `SyntaxError: Unexpected
token` inside `node_modules`.

**Cause**

Your Node.js version is too old. The web app uses Next.js 16, which needs
Node 20.9 or later. Some older docs still say Node 18. That is out of date.

**Fix**

1. Install Node 20 LTS or later, for example with `nvm install 20 && nvm use 20`.
2. Remove the old install and reinstall:

   ```bash
   rm -rf node_modules apps/*/node_modules packages/*/node_modules
   npm install
   ```

### 2. `npm install` fails with `ERESOLVE unable to resolve dependency tree`

**Symptoms**

`npm ERR! ERESOLVE could not resolve` during install.

**Cause**

An npm version older than 10 resolves peer dependencies differently from the
version that produced `package-lock.json` (the repo pins `npm@10.8.2`).

**Fix**

1. Upgrade npm with `npm install -g npm@10`, or run `corepack enable` so the
   pinned version is used.
2. Run `npm install` again. Do **not** pass `--force` or `--legacy-peer-deps`.
   Both can rewrite the lockfile and break CI.

### 3. API exits on startup with "missing required environment variable"

**Symptoms**

`npm run dev -w api` exits immediately. The log names `DATABASE_URL`,
`WEB_ORIGIN` or `PORT` as missing.

**Cause**

`apps/api/.env` does not exist, or is missing a server-required variable. The
API validates its environment at boot
([`apps/api/src/lib/validate-env.ts`](../apps/api/src/lib/validate-env.ts))
and fails fast.

**Fix**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Then restart the API. Missing **optional** variables only produce a warning,
so a warning on its own is not the cause of a crash.

### 4. Web app calls the wrong API URL or uses stale settings

**Symptoms**

- Requests go to an unexpected host, or `NEXT_PUBLIC_*` changes have no
  effect.
- The web env file exists but seems to be ignored.

**Cause**

- The web file must be named `.env.local`, not `.env`.
- `NEXT_PUBLIC_*` values are inlined when the dev server starts. Changes need
  a restart.

**Fix**

1. Make sure the file is `apps/web/.env.local`.
2. Stop and restart `npm run dev -w web`.
3. If the old values persist, delete `apps/web/.next` and restart.

---

## Build

### 5. `npm run typecheck` fails with `Cannot find module '@prisma/client'` or missing Prisma types

**Symptoms**

`Module '"@prisma/client"' has no exported member 'ShareLink'` or similar,
usually right after pulling changes.

**Cause**

The Prisma client is generated code. After a schema change, the client in
`node_modules` is stale until you regenerate it.

**Fix**

```bash
cd apps/api
npx prisma generate
```

Run this after every pull that touches `apps/api/prisma/schema.prisma`.

### 6. Shared package imports fail: `Cannot find module '@devconsole/ui'`

**Symptoms**

The web app or API cannot resolve `@devconsole/ui`, `@devconsole/soroban-utils`
or `@devconsole/api-contracts`.

**Cause**

Workspace packages are linked by `npm install` at the repository root.
Running `npm install` inside `apps/web` or `apps/api` alone does not create
the links. A partial install can also leave them broken.

**Fix**

Always install from the repository root:

```bash
cd <repo-root>
npm install
npm run build   # builds web plus the shared ui and soroban-utils packages
```

### 7. API tests report "no tests found" or run old code

**Symptoms**

`npm run test -w api` finds no tests, or tests don't reflect your edits.

**Cause**

The API test script runs compiled files: `node --test 'dist/**/*.{test,spec}.js'`.
If you haven't built, or the build is stale, Node runs nothing or runs old
output.

**Fix**

```bash
npm run build -w api
npm run test -w api
```

### 8. Contract build fails: `can't find crate for core` or unknown target

**Symptoms**

`cargo test` or `stellar contract build` in `contracts/` fails with a missing
`wasm32` target error.

**Cause**

The Rust wasm target is not installed.

**Fix**

```bash
rustup target add wasm32v1-none           # current Stellar CLI
rustup target add wasm32-unknown-unknown  # older Stellar CLI versions
```

Then rebuild. The Stellar CLI is a separate install. See the
[Stellar setup docs](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup).

---

## Runtime

### 9. Web app loads, but every workspace or share request fails with CORS errors

**Symptoms**

The browser console shows `blocked by CORS policy: No
'Access-Control-Allow-Origin' header`.

**Cause**

The API only accepts requests from `WEB_ORIGIN` (or the `CORS_ORIGINS`
allowlist). If you open the web app on a different host or port, such as
`127.0.0.1:3000` or `localhost:3001`, the origin doesn't match.

**Fix**

1. Open the app at the exact origin in `apps/api/.env` (default
   `http://localhost:3000`).
2. Or update `WEB_ORIGIN` to the origin you use and restart the API.

### 10. Mutations fail with "Owner key must be at least 32 characters long"

**Symptoms**

Creating a share link, syncing a workspace or revoking a share fails with a
`400` error about owner-key length or complexity. Reads work.

**Cause**

When no owner key is stored, the web client sends the placeholder
`default-dev-key`. The API rejects keys that are shorter than 32 characters,
lack upper case, lower case and digits, or contain common patterns.

**Fix**

1. Generate a strong key:

   ```bash
   node -e "const {randomUUID}=require('crypto'); console.log(randomUUID()+randomUUID())"
   ```

   If the output has no uppercase letters, change one letter to upper case.

2. In the browser DevTools console on `http://localhost:3000`, run:

   ```js
   localStorage.setItem("owner-key", "<your key>");
   ```

3. Reload the page. Keep this key private. It is a bearer token: anyone who
   has it can change or delete your workspaces and share links.

### 11. "Too many authentication attempts. Try again later." (401)

**Symptoms**

Owner-key protected requests start failing with `401` after several failed
attempts.

**Cause**

The owner-key guard throttles repeated failed authentication from one client.

**Fix**

Fix the key first (see [issue 10](#10-mutations-fail-with-owner-key-must-be-at-least-32-characters-long)),
wait for the throttle window to pass, then retry. Restarting the API also
clears the in-memory counter in local development.

### 12. Hot reload stops picking up changes

**Symptoms**

You save a file and the web app or API doesn't update. This often happens on
Linux or in WSL.

**Cause**

The OS file-watcher limit is exhausted, or the project lives on a Windows
drive mounted into WSL, where file events don't propagate.

**Fix**

- **Linux:** raise the inotify limit:

  ```bash
  echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  ```

- **WSL:** move the repository into the Linux file system (for example
  `~/code/`), not `/mnt/c/...`.

---

## Database

### 13. `The table 'main.workspaces' does not exist` (Prisma `P2021`)

**Symptoms**

The API starts, but the first request fails with Prisma error `P2021`.

**Cause**

The SQLite database file exists but no schema has been applied, usually
because the setup step was skipped.

**Fix**

```bash
cd apps/api
npx prisma migrate deploy
npm run db:seed
```

### 14. `prisma migrate dev` says drift was detected and asks to reset

**Symptoms**

```
Drift detected: Your database schema is not in sync with your migration history.
We need to reset the SQLite database "dev.db"
```

**Cause**

The database was changed outside migrations. The most common cause is running
`prisma db push`, which the README setup uses. `db push` changes the schema
without recording a migration, so the migration history and the database
disagree.

**Fix**

For a local development database, resetting is safe:

```bash
cd apps/api
npm run db:bootstrap   # reset, reapply all migrations, reseed
```

If you need to keep local data, export what you need first. Avoid mixing
`db push` and `migrate dev` on the same database. For authoring new
migrations, see the
[Prisma migration authoring guide](./prisma-migration-authoring-guide.md).

### 15. `SQLITE_BUSY: database is locked`

**Symptoms**

Requests or migrations fail intermittently with `database is locked`.

**Cause**

Another process holds a write lock on `apps/api/prisma/dev.db`. Typical
culprits are Prisma Studio, a second API instance, or an editor extension
with the file open.

**Fix**

1. Close Prisma Studio and any SQLite browser.
2. Check for a second API process: `lsof apps/api/prisma/dev.db`.
3. Retry the command.

### 16. `npx prisma db seed` does nothing or reports no seed command

**Symptoms**

`npx prisma db seed` prints a warning that no seed command is configured, and
the database stays empty. The demo workspace is missing from the API.

**Cause**

The API does not register a seed command in Prisma's config. The seed script
(`apps/api/prisma/seed.ts`) is wired to an npm script instead.

**Fix**

```bash
cd apps/api
npm run db:seed              # upserts the demo workspace; safe to rerun
npm run db:seed -- --reset   # clears workspace data first, then reseeds
```

---

## Network

### 17. Port already in use (`EADDRINUSE`)

**Symptoms**

`Error: listen EADDRINUSE: address already in use :::3000` (web), `:::4000`
(API), or the Stellar quickstart container fails to bind `8000`.

**Cause**

Another process holds the port. Often it is a previous dev server that did
not exit cleanly.

**Fix**

1. Find the process:

   ```bash
   lsof -i :3000    # or :4000, :8000
   ```

2. Stop it with `kill <PID>`.
3. If you must use another port, change it **everywhere** it appears: `PORT`
   and `WEB_ORIGIN` in `apps/api/.env`, `NEXT_PUBLIC_API_URL` in
   `apps/web/.env.local`. Then run `npm run check-drift`.

### 18. RPC requests fail or time out

**Symptoms**

- Contract reads or simulations fail with `Failed to fetch` or `ETIMEDOUT`.
- The network health indicator shows the network as degraded.

**Cause**

- The public RPC is unreachable, rate-limited or under maintenance.
- On the local network, the quickstart container isn't running or Soroban RPC
  isn't enabled.

**Fix**

1. Test the endpoint directly:

   ```bash
   curl -s -X POST https://soroban-testnet.stellar.org \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```

2. For local development, start the sandbox with RPC enabled:

   ```bash
   docker run --rm -it -p 8000:8000 --name stellar \
     stellar/quickstart:latest --local --enable-soroban-rpc
   ```

3. You can list several fallback URLs, separated by commas, in
   `RPC_ENDPOINTS_*` in `apps/api/.env`. The API proxy fails over between them.

### 19. Friendbot funding fails

**Symptoms**

Funding a new account fails, or the account still shows "not found" after
funding.

**Cause**

- The public Friendbot only funds **testnet** accounts.
- Friendbot rejects accounts that are already funded.

**Fix**

- Testnet: `curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"`.
- Local sandbox: use the container's Friendbot,
  `curl "http://localhost:8000/friendbot?addr=YOUR_PUBLIC_KEY"`.
- If you see "already funded", the account exists. Check that the console and
  Freighter are on the same network.

### 20. Opening a share link returns `429 Too Many Requests`

**Symptoms**

Resolving `/share/<token>` fails with `429` and a `Retry-After` header.

**Cause**

Public share resolution is rate limited to 30 requests per minute per IP, to
prevent token enumeration. Automated tests or rapid reloads can hit it.

**Fix**

Wait for the number of seconds in `Retry-After`. In local development,
restarting the API also clears the in-memory limiter.

---

## FAQ

**Which Node version should I use?**
Node 20 LTS or later, with npm 10. Some older sections of the docs mention
Node 18, which no longer works with Next.js 16.

**Does `npm run dev` start everything?**
No. The root `npm run dev` starts only the web app. Run the API in a second
terminal with `npm run dev -w api`. In VS Code, the `Full Stack: web + API`
debug configuration starts both.

**Should I use `prisma db push` or `prisma migrate dev`?**
Use `db push` only for a quick throwaway local database. Use `migrate dev`
whenever you change `schema.prisma` for a pull request, because only
migrations are applied in other environments. Don't mix them on the same
database (see [issue 14](#14-prisma-migrate-dev-says-drift-was-detected-and-asks-to-reset)).

**How do I start completely fresh?**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/.next
npm install
cd apps/api && npm run db:bootstrap && cd ../..
```

In the browser, clear site data for `localhost:3000`. Workspaces and wallet
state live in `localStorage`.

**Do I need Docker?**
Only for the local Stellar sandbox. Testnet development needs no Docker.

**Do I need Rust?**
Only to build or test the contracts in `contracts/`. Web and API work does
not need it.

**My problem isn't listed. What should I include in an issue?**
Your OS, `node -v`, `npm -v`, the exact command you ran, and the full error
output. From **Settings**, you can also download a support bundle and attach
it. Open an issue at
[GitHub Issues](https://github.com/Ibinola/soroban-dev-console/issues).

## Related docs

- [Quickstart](./quickstart.md)
- [Deploy contract tutorial](./deploy-contract-tutorial.md)
- [Prisma migration authoring guide](./prisma-migration-authoring-guide.md)
- [Debugging helpers](./debugging-helpers.md)
- [Environment profiles](./env-profiles.md)
