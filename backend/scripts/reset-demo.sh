#!/bin/sh
# Nightly demo reset: wipes the database, re-applies migrations and re-seeds.
# The seed skips when users exist, so the schema is dropped first.
# Destroys all data in the target schema. Only point it at the demo database.
set -eu

cd "$(dirname "$0")/.."
export PATH="$PWD/node_modules/.bin:$PATH"

: "${DATABASE_URL:?DATABASE_URL is required}"

CONFIG="--config prisma7.config.ts"
SCHEMA=$(node -e 'console.log(new URL(process.env.DATABASE_URL).searchParams.get("schema") || "public")')

echo "Dropping schema \"$SCHEMA\"..."
printf 'DROP SCHEMA IF EXISTS "%s" CASCADE;\nCREATE SCHEMA "%s";\n' "$SCHEMA" "$SCHEMA" |
  prisma db execute --stdin $CONFIG

echo "Applying migrations..."
prisma migrate deploy $CONFIG

echo "Seeding demo data..."
tsx prisma/seed.ts

echo "Demo reset complete."
