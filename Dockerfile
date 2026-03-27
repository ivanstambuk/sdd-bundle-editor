FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-slim AS runner

# Install Java JRE for PlantUML
RUN apt-get update && apt-get install -y default-jre-headless && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=builder /app /app

ENV PORT=8080
ENV MCP_HTTP_PORT=8080
EXPOSE 8080

CMD ["node", "packages/mcp-server/dist/index.js", "--http", "--config", "bundles.yaml"]
