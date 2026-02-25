#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  "DATABASE_URL"
  "AUTH_JWT_SECRET"
  "AUTH_SALT_ROUNDS"
  "PORT"
)

missing=0
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required environment variable: $var"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "Environment variable check passed."
npm run check
