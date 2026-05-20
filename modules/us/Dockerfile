FROM node:22-alpine AS base

# ── Install deps (workspace-aware) ────────────────────────────────────────────
FROM base AS deps
WORKDIR /repo
COPY package.json ./
COPY packages/sdk-ts/package.json ./packages/sdk-ts/
COPY modules/us/package.json ./modules/us/
RUN npm install --prefer-offline

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY packages/sdk-ts ./packages/sdk-ts
COPY modules/us ./modules/us
WORKDIR /repo/modules/us
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/modules/us/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/modules/us/.next/static     ./modules/us/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "modules/us/server.js"]
