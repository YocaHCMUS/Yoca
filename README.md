# Node + Vite + React + Hono Monorepo

Full-stack TypeScript monorepo with React frontend (Vite) and Hono backend.

Frontend:
- React 19
- TypeScript
- Vite 7
- React Router
- Carbon Design System

Backend:
- Hono 4
- Node.js
- TypeScript
- PostgreSQL + Drizzle ORM

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.

## Getting Started

This monorepo makes use of npm's workspace feature. You don't need to `cd` into `client` or `server` to run these following commands as each of them has assigned with a specific workspace.


### Starting the Server
```bash
npm run server:dev
```
This starts server on `http://localhost:4000` in watch mode - any changes to the server will trigger a restart automatically.

### Starting the Client
```bash
npm run client:dev
```
This starts the frontend Vite client on `http://localhost:3000` in Vite dev mode - any changes will lead to a **H**ot **M**odule **R**eload (which is *not equivalent to a full restart*, but faster to iterate)

### Inspecting the Database
```
npm run db:studio
```

This will open a GUI database dashboard at `http://local.drizzle.studio`. You can see our SQL database's table and schema here. 

## Building for Production
It is recommended that we build and preview our client and server every once in a while to guarantee our builds won't cause niche bugs when deployed.

To build both client and server run:

```bash
npm run build
```

Build files would be in `server\build` and `client\build` for server and client respectively. To preview both server's and client's builds at once use:

```bash
npm run preview
```

### Build for Server

Building server converts our Typescript code to normal Javascript code for Node to run.

```bash
npm run server:build
```

Use Node to run built server:

```bash
npm run server:preview
```

### Build for Client

Similiarly, building client converts our  React and Typescript code to static HTML and Javascript code.

```bash
npm run client:build
```

```bash
npm run client:preview
```