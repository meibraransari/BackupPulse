#!/bin/sh
set -e

echo "===================================================="
echo " Starting BackupPulse Application..."
echo " Node Environment : ${NODE_ENV:-production}"
echo " Database Target  : ${DATABASE_URL}"
echo " Console Logging  : ${ENABLE_CONSOLE_LOG:-true}"
echo "===================================================="

# Retry parameters for database readiness
MAX_RETRIES=30
RETRY_COUNT=0
DELAY=2

echo "[*] Waiting for PostgreSQL database to be ready and reachable..."

until npx prisma db push --skip-generate --accept-data-loss; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[-] FATAL: Could not connect to PostgreSQL after ${MAX_RETRIES} attempts ($((MAX_RETRIES * DELAY))s)." >&2
    echo "[-] Please verify that PostgreSQL is running and reachable at the configured host:port." >&2
    exit 1
  fi
  echo "[!] PostgreSQL is not ready yet (attempt ${RETRY_COUNT}/${MAX_RETRIES}). Retrying in ${DELAY} seconds..."
  sleep $DELAY
done

echo "[+] Database schema synchronized successfully!"
echo "[*] Launching BackupPulse server on port ${PORT:-3000}..."

exec node dist/index.js
