# QR table ordering

Guests scan a table QR code, open a mobile menu, and place an order. Staff see the order on a live dashboard. A table can only accept orders while staff have an open session, so a saved link cannot be used after the guest leaves.

Monorepo: **Neon** Postgres, **Express** API, **admin-web** staff dashboard, **customer-web** guest ordering, **Pusher** realtime.

**Production:** see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Render + Vercel + Neon). OpenAPI: `GET /api/openapi.yaml` (source: `backend/openapi.yaml`).

## Phase 8 contents

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Neon, Render API, Vercel frontends, Pusher, CORS, Cloudinary for menu images, smoke tests
- `render.yaml` — Render blueprint (`rootDir: backend`, migrate on pre-deploy)
- `admin-web/vercel.json`, `customer-web/vercel.json` — SPA rewrites
- `.env.production.example` — production env checklist
- `npm run build:all` — build API + both frontends
- `GET /api/openapi.yaml` — OpenAPI 3 spec

## Phase 7 contents

### Order lifecycle (API)

- Valid transitions: `pending_confirmation` → `placed` | `cancelled`; then kitchen line through `served` → `paid` | `cancelled`
- **Role rules:** kitchen — forward kitchen steps only (no cancel, no confirm, no paid); waiter — forward + cancel, not paid; owner/manager — all transitions including **Mark paid**
- `POST /api/admin/orders/:id/confirm` — only from `pending_confirmation`; kitchen cannot confirm
- `GET /api/admin/orders/:id` — order, **audit timeline** (`events`), `allowedNextStatuses` for the current role
- Paid/cancelled orders leave the live board (`?board=true`) but remain in history via `GET /api/admin/orders`

### Admin UI

- **Reject** (pending), **Cancel**, **Mark paid** (owner/manager), **History** audit modal on each card

## Phase 6 contents

### API

- `GET /api/public/realtime-config` — Pusher key/cluster for guest clients (same shape as staff config)
- Join response and `GET /api/public/sessions/me` now include `sessionId` (for `private-session-{id}` subscriptions)

### Customer web (`customer-web`, port 5173)

```powershell
Copy-Item customer-web\.env.example customer-web\.env
npm install --prefix customer-web
npm run dev:customer
```

Open a table link from admin QR (`customerUrl`, path `/t/{qrToken}`). Flow: view menu → enter PIN when staff opened the table → cart → place order → **My orders** with Pusher `order.status_changed` (20s polling fallback).

## Phase 5 contents

### API

- `POST /api/pusher/auth` — staff JWT for `private-restaurant-{id}`, guest JWT for `private-session-{id}`
- `GET /api/admin/realtime-config` — Pusher key/cluster when configured
- `GET /api/admin/orders?board=true` — active orders for the kitchen board
- `PATCH /api/admin/orders/:id/status`, `POST .../confirm`
- Events after DB commit: `order.created`, `order.updated`, `session.opened`, `session.closed`, guest `order.status_changed`

### Admin web (`admin-web`, port 5174)

```powershell
Copy-Item admin-web\.env.example admin-web\.env
npm install --prefix admin-web
npm run dev:admin
```

Sign in with `owner@demo.local` / `Owner@12345`. The board calls `/health` on load, refetches on Pusher reconnect, and falls back to **Refresh** when Pusher env vars are empty.

Set Pusher Sandbox credentials in root `.env` (`PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER=ap2`) for live updates.

## Phase 4 contents (API)

- `POST /api/orders` — guest Bearer token + **`Idempotency-Key`** header; prices computed on the server; limits from env (`MAX_ITEMS_PER_ORDER`, `MAX_QTY_PER_ITEM`, 3 orders / 10 min per session)
- `GET /api/orders/mine` — orders for the current guest session
- Staff-opened sessions → status **`placed`**; auto-opened sessions (`require_staff_open = false`) → **`pending_confirmation`**
- Totals ≥ `ORDER_VALUE_REVIEW_THRESHOLD` return `flaggedForReview: true` (paise)
- Pusher `order.created` is fired after commit when credentials are set; failures are logged only

```powershell
# After join (guest accessToken):
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/orders `
  -Headers @{ Authorization = "Bearer $guestToken"; "Idempotency-Key" = "order-$(Get-Random)" } `
  -ContentType application/json `
  -Body (@{ items = @(@{ menuItemId = 'MENU_ITEM_UUID'; quantity = 1 }) } | ConvertTo-Json)
```

## Phase 3 contents (API)

- Public menu: `GET /api/public/tables/:qrToken` (no table/restaurant/session UUIDs; `sessionOpen` flag only)
- Guest join: `POST /api/public/sessions/join` with `{ qrToken, pin }` → guest JWT (`GUEST_JWT_SECRET`); PIN rate-limited per IP + QR token
- Guest check: `GET /api/public/sessions/me` (verifies session still **open** and unexpired in the database)
- Staff: `POST /api/admin/tables/:id/sessions` (returns **PIN once**), `POST /api/admin/sessions/:id/close`, `regenerate-pin`, `flag`, `GET /api/admin/sessions?status=open`
- **Waiter / manager / owner** manage sessions; **kitchen** cannot open tables
- If `require_staff_open` is `false`, join without a PIN auto-creates a session (first order confirmation comes in a later phase)

### Try Phase 3 (PowerShell)

```powershell
# Replace QR_TOKEN with a token from GET /api/admin/tables (customerUrl suffix) or the database seed.
Invoke-RestMethod "http://localhost:4000/api/public/tables/QR_TOKEN"
# After POST .../tables/TABLE_ID/sessions and using the returned pin:
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/public/sessions/join `
  -ContentType application/json `
  -Body (@{ qrToken = 'QR_TOKEN'; pin = '1234' } | ConvertTo-Json)
```

## Phase 2 contents (API)

- Staff JWT auth: `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `GET /api/admin/auth/me`
- Role-based access: **owner** and **manager** manage menu and tables; **waiter** and **kitchen** can read menu/tables and download QR images
- Tables CRUD, per-table QR (`GET /api/admin/tables/:id/qr?format=png|svg`), bulk ZIP (`GET /api/admin/tables/qr/bulk.zip`)
- Menu categories and items CRUD, availability toggle, local image upload (`POST /api/admin/menu/items/:id/image`)

### Try Phase 2 (PowerShell)

With Postgres and `npm run dev` running:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/admin/auth/login `
  -ContentType application/json `
  -Body (@{ email = 'owner@demo.local'; password = 'Owner@12345' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod http://localhost:4000/api/admin/auth/me -Headers $headers
Invoke-RestMethod http://localhost:4000/api/admin/tables -Headers $headers
```

Download a table QR as PNG (replace `TABLE_ID`):

```powershell
Invoke-WebRequest "http://localhost:4000/api/admin/tables/TABLE_ID/qr?format=png" -Headers $headers -OutFile table-qr.png
```

## Phase 1 contents

- Local PostgreSQL via **embedded Postgres** (no Docker required), or optional Docker Compose
- Prisma schema for restaurants, staff, tables, sessions, menu, orders, and an order audit log
- Versioned SQL migration, including checks that prices and quantities stay non-negative
- Neon-safe connection rules: pooled `DATABASE_URL`, direct `DIRECT_URL`, `sslmode=require`, pool size 1–10
- Database retry wrapper (3 attempts, exponential backoff) used at startup and by `GET /health`
- Seed data: one restaurant, one owner, sample menu, 10 tables
- Validated environment variables

## Prerequisites

- Node.js 20 or newer
- **Database:** [Neon](https://neon.tech) (free tier, recommended) **or** embedded local Postgres (no Docker)

## Using Neon (recommended)

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Open **Connect** and copy:
   - **Pooled** connection string → `DATABASE_URL` (hostname contains `-pooler`)
   - **Direct** connection string → `DIRECT_URL` (same user/password/db, **no** `-pooler` in the host)
3. Both URLs must include `sslmode=require`. The pooled URL should include `connection_limit=5` (or 1–10).

**Option A — script (PowerShell):**

```powershell
$env:NEON_POOLED="postgresql://USER:PASS@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
$env:NEON_DIRECT="postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
node backend/scripts/set-neon-env.mjs
npm run db:neon:validate
npm run setup
npm run dev
```

**Option B — edit `.env` manually** (comment out localhost lines, set `DATABASE_URL` and `DIRECT_URL`).

You do **not** need `npm run db:local:start` when using Neon. Stop local Postgres if it is still running: `npm run db:local:stop`.

## Run locally (embedded Postgres, without Docker)

**Terminal 1** — start the database (leave this running):

```powershell
Copy-Item .env.example .env
npm install --prefix backend
npm run db:local:start
```

The first start downloads a PostgreSQL binary and creates data under `.local/postgres-data` (gitignored).

**Terminal 2** — migrate, seed, and run the API:

```powershell
npm run setup
npm run dev
```

The API listens on `http://localhost:4000`.

```powershell
Invoke-RestMethod http://localhost:4000/health
```

A healthy response looks like:

```json
{ "status": "ok", "db": "up", "latencyMs": 12 }
```

Stop the database when you are done:

```powershell
npm run db:local:stop
```

If port `5432` is already taken, set `LOCAL_PG_PORT` (for example `5433`) in the environment before `db:local:start`, and point `DATABASE_URL` / `DIRECT_URL` in `.env` at the same port.

Check whether Postgres is up:

```powershell
npm run db:local:status
```

Check the database without starting the API:

```powershell
npm run db:check
```

## Optional: Docker Postgres

If you prefer Docker, use `docker-compose.yml` instead of embedded Postgres:

```powershell
docker compose up -d
npm run setup
npm run dev
```

Do not run embedded Postgres and Docker Postgres on the same port at the same time.

## Seed login (local only)

| Field | Value |
| --- | --- |
| Restaurant | Demo Restaurant |
| Email | owner@demo.local |
| Password | Owner@12345 |

Change this password before any shared or production use. The seed stores a bcrypt hash (cost 12) and does not print the password. Running the seed again is safe: if Demo Restaurant already exists, it does nothing.

Prices in the database are integer paise (₹340.00 is stored as `34000`).

## Test

Start Postgres (embedded or Docker), apply migrations, and seed first (integration tests read the seed data).

```powershell
npm test
```

Unit tests cover the retry wrapper and Neon URL rules. Integration tests call `GET /health` and check the seeded restaurant, owner, menu prices, and 10 unguessable QR tokens.

## Environment variables

Copy `.env.example` to `.env`. Every variable is documented there. Local development uses the same database for both URLs:

- `DATABASE_URL` — queries from the running API. On Neon this host contains `-pooler`, plus `sslmode=require`, `connection_limit` from 1 to 10, and `connect_timeout=15` so a cold start has time to wake before the retry wrapper gives up.
- `DIRECT_URL` — Prisma migrations only. On Neon this is the direct host (no `-pooler`) with `sslmode=require`.

The process refuses to start if a Neon URL breaks those rules. Pusher and Cloudinary can be left blank in development. Production requires real JWT secrets and Pusher credentials.

## Schema changes

Edit `backend/prisma/schema.prisma`, then from `backend`:

```powershell
npm run db:migrate -- --name describe_the_change
```

Commit the new folder under `backend/prisma/migrations`. Other machines apply it with `npm run db:deploy`.

## Layout

```
backend/           API (Express), Prisma, OpenAPI, tests
admin-web/         Staff dashboard (Vite + React)
customer-web/      Guest ordering (Vite + React)
docs/DEPLOYMENT.md Production guide
render.yaml        Render API blueprint
docker-compose.yml Optional local Postgres
.env.example       Local development
.env.production.example
.local/            Embedded Postgres data (gitignored)
```

`app` is exported separately from `server.ts` for tests and long-running deploys.
