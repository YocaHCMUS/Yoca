# Redeploy Yoca on Render

This repository is a monorepo with two Render services:

- **Backend**: Render **Web Service** (Node)
- **Frontend**: Render **Static Site** (Vite/React)

Do not create a new service unless the old service no longer exists. Update the two existing services in the Render Dashboard and redeploy the commit that contains these fixes.

## 1. Local validation

Run these commands from the repository root:

```powershell
npm install
npm run typecheck
npm run build
```

Only proceed when both `typecheck` and `build` finish without errors.

## 2. Commit and push

```powershell
git status
git add .
git commit -m "Fix typed chat usage route and prepare Render deploy"
git push origin YOUR_RENDER_BRANCH
```

Replace `YOUR_RENDER_BRANCH` with the branch selected in the Build & Deploy section of both existing Render services. In many projects this is `main`, but confirm it before pushing.

## 3. Backend Web Service configuration

In the existing backend service: **Settings > Build & Deploy**. Keep **Root Directory blank** because the root `package.json` controls npm workspaces.

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm install && npm run server:build` |
| Start Command | `npm run server:preview` |
| Health Check Path | `/api` |
| Auto-Deploy | Yes, on the selected branch |

In **Environment**, preserve the values you previously used and update/add these:

```text
NODE_ENV=production
SERVER_PORT=10000
CLIENT_PROD_DOMAIN=https://YOUR-FRONTEND-SITE.onrender.com
WEBHOOK_PUBLIC_URL=https://YOUR-BACKEND-SERVICE.onrender.com
```

Also make sure all required variables shown in `server/.env.render.example` exist in Render. Do not upload or commit a real `.env` file.

After saving, choose **Manual Deploy > Deploy latest commit** if automatic deploy does not start. Then check:

```text
https://YOUR-BACKEND-SERVICE.onrender.com/api
```

Expected response:

```json
{ "status": "ok" }
```

## 4. Frontend Static Site configuration

In the existing frontend Static Site: **Settings > Build & Deploy**. Keep **Root Directory blank**.

| Setting | Value |
|---|---|
| Build Command | `npm install && npm run client:build` |
| Publish Directory | `client/build` |
| Auto-Deploy | Yes, on the selected branch |

In **Environment**, update these using the exact public backend domain, without a trailing slash:

```text
VITE_APP_ENV=production
VITE_CLIENT_API_DOMAIN=https://YOUR-BACKEND-SERVICE.onrender.com
VITE_API_DOMAIN=https://YOUR-BACKEND-SERVICE.onrender.com
VITE_PROFILE_DATA_SOURCE=api
VITE_USE_WALLET_MOCKS=false
```

Copy any other public values you need from `client/.env.render.example`. Remember: every `VITE_*` value is bundled into browser JavaScript, so never place server secrets there.

Add this React Router fallback in **Redirects/Rewrites**:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

Save and redeploy the static site. `VITE_*` values are build-time values, so saving the variable without rebuilding does not update the live site.

## 5. Cross-service check

- `CLIENT_PROD_DOMAIN` must be exactly the frontend URL, such as `https://yoca-web.onrender.com`.
- `VITE_CLIENT_API_DOMAIN` and `VITE_API_DOMAIN` must be exactly the backend URL, such as `https://yoca-api.onrender.com`.
- Do **not** append `/api` or a final `/` to either frontend variable.
- If Google login is used, add the frontend URL as an Authorized JavaScript Origin in the matching Google OAuth client.

## 6. Database migrations

Do not run migrations during this redeploy unless you actually added a new migration file and intend to change production schema. If required, use a safe one-off command from the backend service shell or a configured pre-deploy step:

```powershell
npm run db:migrate
```

Never use `db:clear`, `db:reset`, or `db:push-force` against production.

## 7. What was fixed in this package

1. `server/src/routes/chat.route.ts`: the typed Hono route now includes `GET /api/chat/usage`; this resolves the client TypeScript error on `client.api.chat.usage.$get()`.
2. `client/src/pages/wallet/RightSidebar.tsx`: corrected the SVG click event type.
3. `server/src/main.ts`: binds to Render's `PORT` and host `0.0.0.0`, with local `SERVER_PORT` fallback.
4. `server/drizzle.config.ts`: no longer fails when a local `.env` file is absent on Render.
5. `.gitignore`: ignores actual env files and no longer ignores `package-lock.json`.
