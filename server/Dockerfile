FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

COPY server/ ./server/
RUN npm run build -w=server

FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci -w server --omit=dev
RUN npm install -w server --no-save drizzle-kit@0.31.7
COPY --from=builder /app/server/build ./server/build
COPY --from=builder /app/server/postgresdb ./server/postgresdb
COPY --from=builder /app/server/drizzle.config.ts ./server/
COPY --from=builder /app/server/drizzle-empty.config.ts ./server/
EXPOSE 4000
CMD ["node", "server/build/main.js"]
