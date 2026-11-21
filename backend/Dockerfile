# Development stage (used by docker-compose with npm run start:dev + bind-mounted src/)
FROM node:22-alpine AS dev
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN mkdir -p /storage/file /storage/block

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Build stage
FROM dev AS builder
RUN npm run build

# Production stage
FROM node:22-alpine AS prod
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /storage/file /storage/block

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/main.js"]
