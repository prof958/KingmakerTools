FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build && rm -rf .next/cache

# Runtime image: production dependencies only, plus what the start command
# needs (prisma/ for migrations, src/ for the seed script).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force && rm -rf node_modules/@next/swc-*-gnu
COPY --from=build /app/.next ./.next
COPY --from=build /app/src ./src
COPY public ./public
COPY prisma ./prisma
COPY prisma.config.ts next.config.ts tsconfig.json docker-entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
# Apply any pending DB migrations, load the item catalog (idempotent), then
# start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm start"]
