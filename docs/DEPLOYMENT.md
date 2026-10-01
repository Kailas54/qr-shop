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
4. **Build:** `npm install && npm run build && npm run db:deploy:prod` (migrations run here — Render **free** tier does not support pre-deploy commands; `render.yaml` is already set up this way).
5. **Start:** `npm run start`
6. **Health check path:** `/health`

   Set `DATABASE_URL` and `DIRECT_URL` on Render **before** the first deploy so the build step can reach Neon.

After deploy, note the URL (e.g. `https://qr-ordering-api.onrender.com`). Cold starts on free tier can take ~30s; the health check and client retries account for that.

**Menu images:** Render’s disk is ephemeral. Set `STORAGE_PROVIDER=cloudinary` and Cloudinary env vars for production menu uploads.

## 3. Admin app on Vercel

1. Import the repo; set **Root Directory** to `admin-web`.
2. **Build command:** `npm run build`
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

## 8. Smoke test after deploy

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
