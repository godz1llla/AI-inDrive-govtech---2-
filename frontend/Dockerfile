# ──────────────────────────────────────────────────────────
# AgroScore AI — Frontend Dockerfile (multi-stage build)
# Stage 1: Build React app with Vite
# Stage 2: Serve static files with nginx
# ──────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: forward all routes to index.html (SPA support)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
