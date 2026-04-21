#!/bin/sh
set -eu

mkdir -p /data
chown nextjs:nodejs /data

su-exec nextjs node scripts/migrate.mjs
exec su-exec nextjs "$@"
