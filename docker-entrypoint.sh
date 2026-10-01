#!/bin/sh
set -e

if [ -z "$APP_PASSWORD_HASH" ] && { [ -z "$APP_PASSWORD" ] || [ "$APP_PASSWORD" = "change-me" ]; }; then
  echo "KingmakerTools: set APP_PASSWORD in docker-compose.yml before starting (it's what your party logs in with)." >&2
  exit 1
fi

# No SESSION_SECRET given: generate one once and keep it in /app/data, so
# self-hosters don't have to, and logins survive restarts and updates.
if [ -z "$SESSION_SECRET" ]; then
  mkdir -p /app/data
  if [ ! -s /app/data/session-secret ]; then
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > /app/data/session-secret
  fi
  SESSION_SECRET="$(cat /app/data/session-secret)"
  export SESSION_SECRET
fi

exec "$@"
