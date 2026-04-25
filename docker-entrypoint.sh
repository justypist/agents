#!/bin/sh
set -eu

mkdir -p /workspace
mkdir -p /persist

link_persist_dir() {
  target="$1"
  source="$2"

  mkdir -p "$source"

  if [ -L "$target" ]; then
    return
  fi

  if [ -d "$target" ] && [ -z "$(find "$source" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
    cp -a "$target/." "$source/" 2>/dev/null || true
  fi

  rm -rf "$target"
  ln -s "$source" "$target"
}

link_persist_dir /root /persist/home
link_persist_dir /opt/agents/bin /persist/bin
link_persist_dir /opt/agents/tools /persist/tools
link_persist_dir /var/cache/apt /persist/apt/cache
link_persist_dir /var/lib/apt/lists /persist/apt/lists

for persist_dir in \
  /persist/cache \
  /persist/config \
  /persist/share \
  /persist/npm \
  /persist/pnpm \
  /persist/cache/npm \
  /persist/cache/pip \
  /persist/cache/uv \
  /persist/uv/tools \
  /persist/cargo \
  /persist/rustup \
  /persist/go \
  /persist/cache/go-build \
  /persist/cache/go-mod \
  /persist/composer \
  /persist/m2 \
  /persist/gradle \
  /persist/dotnet \
  /persist/ms-playwright \
  /persist/huggingface
do
  mkdir -p "$persist_dir"
done

mkdir -p /var/cache/apt/archives/partial
mkdir -p /var/lib/apt/lists/partial

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/opt/agents/bin sh
fi

if ! find /var/lib/apt/lists -type f -name '*_Packages*' | grep -q .; then
  apt-get update
fi

node scripts/migrate.mjs
exec "$@"
