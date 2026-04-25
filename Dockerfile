FROM node:lts-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="/opt/agents/bin:$PNPM_HOME:$PATH"
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS migrate-deps
COPY package.json ./
RUN node -e "const fs = require('node:fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); const getVersion = name => pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]; const dependencies = { 'drizzle-orm': getVersion('drizzle-orm'), postgres: getVersion('postgres') }; for (const [name, version] of Object.entries(dependencies)) { if (!version) throw new Error('Missing dependency version for ' + name); } fs.writeFileSync('package.json', JSON.stringify({ name: 'migrate-deps', private: true, dependencies }));"
RUN pnpm install --prod

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV HOME=/root
ENV EXEC_WORKSPACE_PATH=/workspace
ENV XDG_CACHE_HOME=/persist/cache
ENV XDG_CONFIG_HOME=/persist/config
ENV XDG_DATA_HOME=/persist/share
ENV PNPM_HOME=/persist/pnpm
ENV NPM_CONFIG_PREFIX=/persist/npm
ENV NPM_CONFIG_CACHE=/persist/cache/npm
ENV PIP_CACHE_DIR=/persist/cache/pip
ENV UV_CACHE_DIR=/persist/cache/uv
ENV UV_TOOL_DIR=/persist/uv/tools
ENV UV_TOOL_BIN_DIR=/opt/agents/bin
ENV CARGO_HOME=/persist/cargo
ENV RUSTUP_HOME=/persist/rustup
ENV GOPATH=/persist/go
ENV GOCACHE=/persist/cache/go-build
ENV GOMODCACHE=/persist/cache/go-mod
ENV COMPOSER_HOME=/persist/composer
ENV MAVEN_CONFIG=/persist/m2
ENV GRADLE_USER_HOME=/persist/gradle
ENV DOTNET_CLI_HOME=/persist/dotnet
ENV PLAYWRIGHT_BROWSERS_PATH=/persist/ms-playwright
ENV HF_HOME=/persist/huggingface
ENV PATH="/persist/npm/bin:/persist/pnpm:/persist/cargo/bin:/persist/go/bin:/persist/dotnet/tools:/opt/agents/bin:$PATH"
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
  && printf 'Binary::apt::APT::Keep-Downloaded-Packages "true";\n' > /etc/apt/apt.conf.d/keep-cache \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  curl \
  git \
  gnupg \
  jq \
  openssh-client \
  procps \
  python3 \
  python3-pip \
  sqlite3 \
  unzip \
  xz-utils
RUN mkdir -p /opt/agents/bin \
  && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/opt/agents/bin sh
RUN mkdir -p /data /workspace /persist /root /opt/agents/bin /opt/agents/tools /var/cache/apt /var/lib/apt/lists
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=migrate-deps /app/node_modules ./node_modules
COPY --chown=root:root docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 755 ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
