# ──────────────────────────────────────────────────
# KingdomTools — Multi-stage Docker build
# ──────────────────────────────────────────────────

# Stage 1: Install production dependencies (for the final image)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build the application (needs ALL dependencies including dev)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js in standalone mode
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema, migrations, and generated client for `prisma migrate deploy`
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated

# Copy full production node_modules (from deps stage) so prisma CLI works
COPY --from=deps /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
