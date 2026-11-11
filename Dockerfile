FROM node:26-bookworm-slim AS build

WORKDIR /app

RUN npm install -g pnpm@12.14.0

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=api

FROM node:26-bookworm-slim

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
