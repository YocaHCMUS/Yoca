# Contents of Yoca-Render-patch.zip

Extract this archive **into the existing project root** (`D:\DATN\Yoca`). It contains only deployment fixes and does not contain `.env` secrets or `node_modules`.

Changed code files:

- `server/src/routes/chat.route.ts`
- `client/src/pages/wallet/RightSidebar.tsx`
- `server/src/main.ts`
- `server/drizzle.config.ts`
- `.gitignore`

Added deployment helpers:

- `RENDER_DEPLOY.md`
- `scripts/prepare-render-deploy.ps1`
- `client/.env.render.example`
- `server/.env.render.example`
- `render.yaml.example`

After extraction, follow `RENDER_DEPLOY.md` in the project root.
