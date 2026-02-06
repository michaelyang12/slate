# ---- base ----
FROM oven/bun:1.0 AS base
WORKDIR /app

# ---- install deps ----
FROM base AS deps
COPY bun.lockb package.json ./
RUN bun install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY . .
RUN bun run build

# ---- runtime ----
FROM oven/bun:1.0-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# copy built output
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./

# install only prod deps
RUN bun install --production

EXPOSE 3000

CMD ["bun", "run", "build/index.js"]
