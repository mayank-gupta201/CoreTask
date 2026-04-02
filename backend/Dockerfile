FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
RUN bun install -g pm2
COPY ecosystem.config.js .

EXPOSE 4000
CMD ["pm2-runtime", "ecosystem.config.js"]

