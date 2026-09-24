# syntax=docker/dockerfile:1
# Campaign — production image (Next.js standalone, non-root, healthcheck).

FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only: src/env.ts validates on import. Real values come from the
# runtime environment (.env on the VPS) and never enter the image.
RUN export AUTH_URL=http://build.invalid \
      AUTH_SECRET=build-placeholder-build-placeholder-000 \
      AUTH_GOOGLE_ID=build AUTH_GOOGLE_SECRET=build \
      DATABASE_URL=postgresql://build:build@localhost:5432/build \
  && npx prisma generate \
  && npm run build

# One-off tasks (schema push, seed) with the full toolchain:
#   docker compose run --rm tools npx prisma db push
FROM build AS tools
CMD ["npx", "prisma", "--version"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=6s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "server.js"]
