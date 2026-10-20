#!/bin/sh
# start   : run the API (set MIGRATE_ON_START=true to apply migrations first)
# migrate : apply pending migrations and exit
# reset   : drop the schema, migrate and re-seed (demo data only)
set -eu
export PATH="/app/node_modules/.bin:$PATH"

case "${1:-start}" in
  start)
    if [ "${MIGRATE_ON_START:-false}" = "true" ]; then
      prisma migrate deploy --config prisma7.config.ts
    fi
    exec node dist/main.js
    ;;
  migrate)
    exec prisma migrate deploy --config prisma7.config.ts
    ;;
  reset)
    exec sh scripts/reset-demo.sh
    ;;
  *)
    exec "$@"
    ;;
esac
