# ==============================================================================
# Stage 1: Frontend Build (React + Vite + Tailwind)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Backend Build (TypeScript + Prisma)
# ==============================================================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

RUN apk add --no-cache openssl

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner (Unified Single-Container Deployment)
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install openssl for Prisma and curl for Docker healthchecks
RUN apk add --no-cache openssl curl bash

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Setup backend runtime
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose server port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start script: run prisma db sync & start node server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
