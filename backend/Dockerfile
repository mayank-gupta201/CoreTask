FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
RUN npm install -g pm2
COPY ecosystem.config.js .

EXPOSE 4000
CMD ["pm2-runtime", "ecosystem.config.js"]
