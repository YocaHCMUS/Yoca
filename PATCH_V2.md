# Render patch v2

This patch fixes the final TypeScript error in `ChatContext.tsx`.

## What changed

The `GET /api/chat/usage` call now uses the browser `fetch` API with
`credentials: "include"` instead of the Hono typed client. The Hono client
correctly exposes 200/401 responses but TypeScript cannot safely infer a
single return type from `.then((res) => res.json())` across that union.

All other typed Hono client calls remain unchanged.

## Apply

Extract this ZIP into the repository root (`D:\\DATN\\Yoca`) and allow it to
replace only `client/src/components/wallet/WalletChat/ChatContext.tsx`.
Then run:

```powershell
npm run typecheck
npm run build
```
