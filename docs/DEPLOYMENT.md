# Production deployment (free-tier friendly)

Typical layout:

| Component | Host | Free tier |
| --- | --- | --- |
| PostgreSQL | [Neon](https://neon.tech) | Yes |
| API (`backend`) | [Render](https://render.com) Web Service | Yes (sleeps when idle) |
| Staff UI (`admin-web`) | [Vercel](https://vercel.com) | Yes |
| Guest UI (`customer-web`) | Vercel (second project) | Yes |
| Realtime | [Pusher](https://pusher.com) Channels sandbox | Yes |

## 1. Neon database

1. Create a project in the [Neon console](https://console.neon.tech).
2. Copy **pooled** and **direct** connection strings into `.env` (see root README).
3. From the repo root:

   ```powershell
   npm run db:neon:validate
   npm run setup
   ```

4. **Backups:** Neon keeps history on paid plans; on free tier, export periodically:
   - Neon console → **Branches** → create a branch before risky changes, or
   - `pg_dump` using the direct connection string (store dumps off-repo).

5. Change the demo owner password after first deploy (new bcrypt hash via admin tooling or SQL).

## 2. API on Render

1. Push this repo to GitHub.
2. Render → **New** → **Blueprint** → connect repo (`render.yaml`), or **Web Service** with **Root directory** `backend`.
3. Set environment variables from `.env.production.example` (especially `DATABASE_URL`, `DIRECT_URL`, JWT secrets, Pusher, `CORS_ORIGINS`, `CUSTOMER_APP_URL`, `ADMIN_APP_URL`).
4. **Build:** `npm install --include=dev && npm run build && npm run db:deploy:prod` — required because `NODE_ENV=production` omits devDependencies (`typescript`, `prisma`, `@types/*`) unless you pass `--include=dev`. Migrations run in this step (free tier has no pre-deploy).
5. **Start:** `npm run start`
6. **Health check path:** `/health`

   Set `DATABASE_URL` (Neon **pooled** string) and `DIRECT_URL` (Neon **direct** string) on Render **before** the first deploy so the build step can reach Neon. You can paste Neon’s URLs as-is; at runtime the API adds `connection_limit=5` and related pool params if they are missing.

   **Quick fix without redeploy:** append `&connection_limit=5` to the pooled `DATABASE_URL` in Render → Environment, save, and restart.

After deploy, note the URL (e.g. `https://qr-ordering-api.onrender.com`). Cold starts on free tier can take ~30s; the health check and client retries account for that.

**Menu images:** Render’s disk is ephemeral. Set `STORAGE_PROVIDER=cloudinary` and Cloudinary env vars for production menu uploads.

## 3. Admin app on Vercel

1. Import the repo; set **Root Directory** to `admin-web` (Vercel still clones the full repo so `../shared` is available).
2. **Install / build:** `vercel.json` runs `npm install && node ../scripts/install-shared.mjs` so `../shared` gets its own `node_modules` (needed for `tsc` on i18n). **Build:** `npm run build`.
3. **Output:** `dist`
4. Environment variable (build time):

   | Name | Example |
   | --- | --- |
   | `VITE_API_URL` | `https://qr-ordering-api.onrender.com` |

5. `vercel.json` rewrites all routes to the SPA (orders board, tables, QR screen).

Set `ADMIN_APP_URL` on the API to your Vercel admin URL.

## 4. Customer app on Vercel

Same as admin, but **Root Directory** `customer-web` and the same `VITE_API_URL`.

Set `CUSTOMER_APP_URL` on the API to this URL. Table QR codes use `CUSTOMER_APP_URL/t/{qrToken}`.

## 5. Pusher

1. Create a Channels app; set cluster to match your region (`ap2`, `ap4`, etc.).
2. Put `PUSHER_*` on Render.
3. No extra CORS config for Pusher; channel auth goes through `POST /api/pusher/auth` on your API.

## 6. CORS

`CORS_ORIGINS` must list **both** frontend origins, comma-separated, no spaces:

```env
CORS_ORIGINS=https://your-admin.vercel.app,https://your-customer.vercel.app
```

Redeploy the API after changing URLs.

## 7. OpenAPI

- Spec file: `backend/openapi.yaml`
- Live (when API is running): `GET /api/openapi.yaml`
- Import into Postman, Swagger UI, or Stoplight for testing.

## 8. “Failed to fetch” on staff login

The admin app calls `VITE_API_URL` from the **browser**. A generic “Failed to fetch” almost always means the request never reached the API.

| Check | Where | What to set |
| --- | --- | --- |
| API base URL | **Vercel** → admin project → **Environment** | `VITE_API_URL` = `https://<your-service>.onrender.com` (no trailing slash) |
| Rebuild | Vercel | **Redeploy** after changing `VITE_API_URL` (Vite bakes it in at build time) |
| CORS | **Render** → API → Environment | `CORS_ORIGINS` = `https://<admin>.vercel.app,https://<customer>.vercel.app` (exact origins, `https`, no trailing slash) |
| API up | Browser | Open `https://<api>.onrender.com/health` — first hit on free tier can take ~30s while the service wakes |
| Demo user | Neon DB | Run seed once against production (`npm run db:seed` with production `.env`) or login will return **401**, not “Failed to fetch” |

In the browser: **F12 → Network** → click the failed `login` request. If the URL is `http://localhost:4000/...`, fix `VITE_API_URL` and redeploy.

## 9. Smoke test after deploy

```powershell
$api = "https://your-api.onrender.com"
Invoke-RestMethod "$api/health"
Invoke-RestMethod "$api/api/openapi.yaml" | Out-Null

$login = Invoke-RestMethod -Method Post -Uri "$api/api/admin/auth/login" `
  -ContentType application/json `
  -Body '{"email":"owner@demo.local","password":"YOUR_NEW_PASSWORD"}'
```

Open admin → Tables → open a session → open guest link → place an order → confirm on the board.

## Local production build check

```powershell
npm run build:all
cd backend && dotenv -e ../.env -- node dist/server.js
```
