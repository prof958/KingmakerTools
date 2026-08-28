FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
# Apply any pending DB migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
