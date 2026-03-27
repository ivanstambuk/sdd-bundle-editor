FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-slim AS runner

# Install Java JRE for PlantUML, along with curl and graphviz
RUN apt-get update && apt-get install -y default-jre-headless curl graphviz && rm -rf /var/lib/apt/lists/*

# Download PlantUML
RUN mkdir -p /app/tools/plantuml && \
    curl -L https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar -o /app/tools/plantuml/plantuml.jar

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=builder /app /app

ENV PORT=8080
ENV MCP_HTTP_PORT=8080
EXPOSE 8080

CMD ["node", "packages/mcp-server/dist/index.js", "--http", "--config", "bundles.yaml"]
