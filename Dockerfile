# ---- Builder ----
FROM oven/bun:1 AS builder
WORKDIR /app

ARG TURSO_URL
ARG TURSO_AUTH_TOKEN
ARG API_KEY

# Make them available to Bun
ENV TURSO_URL=$TURSO_URL
ENV TURSO_AUTH_TOKEN=$TURSO_AUTH_TOKEN
ENV API_KEY=$API_KEY

# Copy only lockfile and package.json first (for caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source and build
COPY . .
RUN bun run build

# ---- Runtime ----
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy build output and dependencies
COPY --from=builder /app/.svelte-kit ./svelte-kit
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port your Svelte/Bun server runs on
EXPOSE 3000

# Start the app
CMD ["bun", "run", "build/index.js"]