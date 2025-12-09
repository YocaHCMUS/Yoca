# Commands Cheatsheet

## Workspaces
This monorepo uses npm workspaces. Commands can be run three ways:

1. From root - can affect both or specific workspace:

```bash
# Start both client and server
npm run dev

# Build both
npm run build

# Clean both
npm run clean

# Lint both
npm run lint

# Just client
npm run client:dev

# Just server
npm run server:dev
```

2. From individual workspace - either `cd client/` or `cd server/`:

```bash
# Runs that workspace's dev
npm run dev

# Builds that workspace
npm run build

# Lints that workspace
npm run lint
```

3. Using workspace flag from root:

```bash
# Same as npm run client:dev
npm run dev -w=client

# Build all workspaces (-ws flag)
npm run build -ws
```

**How npm Workspaces Work ?**

The root `package.json` has a `scripts` section that "tunnels" commands to individual workspaces using the `-w` (single workspace) and `-ws` (all workspaces) flags:

```json
// root package.json
"scripts": {
  "dev": "npm run dev -w=server & npm run dev -w=client",
  "client:dev": "npm run dev -w=client",
  "server:dev": "npm run dev -w=server"
}
```

This means `npm run client:dev` calls `npm run dev -w=client`, which runs the `dev` script in `client/package.json`. You can also do it manually:
- From root: `npm run dev -w=client` - same as `npm run client:dev`
- From `client/`: `npm run dev` - runs locally without the `-w` flag

## Commands

### Development

```bash
# Watch mode for both (tsx for server, vite for client)
npm run dev

# Server only: tsx watch src/main.ts
npm run server:dev

# Client only: vite dev server
npm run client:dev
```

### Building

```bash
# Compile TS --> JS, output to server/build/ and client/build/
npm run build

# Client only: vite build
npm run build -w=client 

# Server only: tsc + tsc-alias
npm run build -w=server 

# Remove build directories
npm run clean
```

### Running Production Build

```bash
# Start server (node build/main.js) + vite preview
npm run preview

# Just the server
npm run server:preview
```

### Check Types

```bash
# Check TS errors without building
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

Better than linting for quick feedback—no need for strict ESLint rules during development.

### Linting

Linting is very strict (no unused vars, no `any`, strict mode, etc.). Use during CI/before pushing, not while developing.

```bash
# Lint both (eslint .)
npm run lint

# Client only
npm run lint -w=client

# Server only
npm run lint -w=server
```

If you get lint errors, you must fix them (they won't auto-fix due to strict rules).

### Database Commands

These tunnel to `server/`:

```bash
# Generate migrations from schema
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Push schema changes to DB
npm run db:push

# Force push (use carefully)
npm run db:push-force

# Seed database
npm run db:seed

# Open Drizzle Studio GUI
npm run db:studio
```

*Note*: `db:seed` is still basic—just seeds a few test users. Not for production data.

## Adding Dependencies

```bash
# Add to client only
npm install <package> -w=client

# Add to server only
npm install <package> -w=server

# Add to both
npm install <package> -ws
```

## Project Structure

```
client/              
├── src/
│   ├── components/
│   ├── pages/
│   ├── api/
│   ├── contexts/
│   ├── services/
│   └── styles/
├── package.json
└── vite.config.ts

server/
├── src/
│   ├── routes/ # API endpoints
│   ├── services/ # Business logic
│   ├── db/ # Database & schema
│   ├── middlewares/
│   └── config/
├── package.json
└── tsconfig.json
```

## Type Safety

Client can import types from server (no runtime code):

```typescript
// client/src/api/main.ts
import type { AppType } from "@sv/src/main";
```

See `client/tsconfig.json` for path alias config (`@sv`).

## Troubleshooting

1. Node modules messed up?

- Reinstalling is recommended:
```bash
rm -rf node_modules package-lock.json client/node_modules server/node_modules
npm install
```

2. Ports in use?
- Client: change in `client/vite.config.ts`
- Server: change in `server/src/main.ts`

3. Type imports broken?
Check path alias in `client/tsconfig.json` --> `../server/src/*`

## See Also
- [Vite](https://vite.dev/) | [React](https://react.dev/) | [Hono](https://hono.dev/) | [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
