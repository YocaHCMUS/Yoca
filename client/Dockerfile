FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci -w client -w server

COPY client/ ./client/
COPY server/src/ ./server/src/

ARG VITE_CLIENT_API_DOMAIN
ENV VITE_CLIENT_API_DOMAIN=$VITE_CLIENT_API_DOMAIN
RUN npm run build -w=client

FROM nginx:alpine
COPY --from=builder /app/client/build /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
