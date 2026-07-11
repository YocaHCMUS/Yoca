# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Copy package manifests (all workspaces needed for npm workspace resolution)
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Install all deps (dev included) for server compilation
RUN npm ci

# Copy source + tsconfig
COPY server/tsconfig.json server/tsconfig.json
COPY server/src server/src

# Build server: compile TS + resolve @sv/* path aliases
RUN rm -rf server/build && \
    npx tsc -p server/tsconfig.json && \
    npx tsc-alias -p server/tsconfig.json

# ============
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# Copy only needed manifests (client/package.json required for workspace graph)
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Install only server production deps (skip client deps entirely)
RUN npm ci --omit=dev --workspace=server --include-workspace-root

# Copy compiled server
COPY --from=build /app/server/build server/build

ENV NODE_ENV=production
EXPOSE 4000
WORKDIR /app/server
CMD ["sh", "-c", "exec /app/node_modules/.bin/tsx build/main.js || exec /app/server/node_modules/.bin/tsx build/main.js"]
