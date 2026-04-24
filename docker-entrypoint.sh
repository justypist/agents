#!/bin/sh
set -eu

mkdir -p /data
chown nextjs:nodejs /data

if [ -S /var/run/docker.sock ]; then
  docker_gid="$(stat -c '%g' /var/run/docker.sock)"
  addgroup -g "$docker_gid" dockersock 2>/dev/null || true
  addgroup nextjs dockersock 2>/dev/null || true
fi

su-exec nextjs node scripts/migrate.mjs
exec su-exec nextjs "$@"
