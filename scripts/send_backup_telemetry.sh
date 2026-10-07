#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Single Telemetry Report Sender (curl)
# ==============================================================================
# Purpose: Push a single backup record to the central BackupPulse monitoring hub.
# Designed for easy, lightweight integration into existing backup shell scripts.
#
# Usage (Standalone Test):
#   ./scripts/send_backup_telemetry.sh
#   ./scripts/send_backup_telemetry.sh "my-database" "db" "SUCCESS" "db_backup.sql.gz"
#   ./scripts/send_backup_telemetry.sh "ecommerce-api" "code" "FAILED" "code.tar.gz" "Disk full"
# ==============================================================================

set -u

# ------------------------------------------------------------------------------
# 1. BACKUPPULSE HUB SETTINGS (Update to point to your central hub)
# ------------------------------------------------------------------------------
HUB_API_URL="${BACKUP_HUB_URL:-http://localhost:3000/api/v1/backups/report}"
HUB_API_KEY="${BACKUP_API_KEY:-bkp_live_secret_key_12345}"

# ------------------------------------------------------------------------------
# 2. BACKUP JOB PARAMETERS (Passed as arguments or use sample defaults)
# ------------------------------------------------------------------------------
# Argument 1: Project Name (e.g., 'billing-db', 'ecommerce-core')
PROJECT_NAME="${1:-sample-project}"

# Argument 2: Backup Type ('db', 'code', or 'full')
BACKUP_TYPE="${2:-db}"

# Argument 3: Status ('SUCCESS', 'FAILED', or 'WARNING')
STATUS="${3:-SUCCESS}"

# Argument 4: Filename of the backup artifact
ZIP_FILENAME="${4:-${PROJECT_NAME}_$(date +%Y%m%d_%H%M%S).tar.gz}"

# Argument 5: Optional error message (if status is FAILED)
ERROR_MSG="${5:-}"

# ------------------------------------------------------------------------------
# 3. SYSTEM & RUNTIME TELEMETRY (Auto-detected)
# ------------------------------------------------------------------------------
SERVER_ID="$(hostname -s 2>/dev/null || echo "srv-$(hostname 2>/dev/null || echo 'node1')")"
HOSTNAME="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
ENVIRONMENT="production"

# Timestamps in ISO 8601 UTC format (e.g. 2026-10-07T05:00:00Z)
END_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_TIME="$(date -u -d '2 minutes ago' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "$END_TIME")"
DURATION_SECONDS=120

# Backup sizing & S3 cloud metadata (customize if available in your script)
BACKUP_SIZE_BYTES=52428800               # 50 MB in bytes
BACKUP_SIZE_HUMAN="50.00 MB"
S3_BUCKET="company-backup-vault"
S3_KEY="servers/${PROJECT_NAME}/${ZIP_FILENAME}"
S3_URL="s3://${S3_BUCKET}/${S3_KEY}"
CHECKSUM=""                             # Optional SHA256 checksum

# Exit code handling
if [ "$STATUS" = "FAILED" ]; then
  EXIT_CODE=1
  [ -z "$ERROR_MSG" ] && ERROR_MSG="Backup script terminated with non-zero exit code"
else
  EXIT_CODE=0
fi

# ------------------------------------------------------------------------------
# 4. BUILD JSON PAYLOAD
# ------------------------------------------------------------------------------
# Escape string for safe JSON embedding
clean_error=$(echo "$ERROR_MSG" | tr -d '\n\r"' | sed 's/[\]//g')

JSON_PAYLOAD=$(cat <<EOF
{
  "server_id": "${SERVER_ID}",
  "hostname": "${HOSTNAME}",
  "server_ip": "${SERVER_IP}",
  "project_name": "${PROJECT_NAME}",
  "environment": "${ENVIRONMENT}",
  "backup_type": "${BACKUP_TYPE}",
  "status": "${STATUS}",
  "start_time": "${START_TIME}",
  "end_time": "${END_TIME}",
  "duration_seconds": ${DURATION_SECONDS},
  "backup_size_bytes": ${BACKUP_SIZE_BYTES},
  "backup_size_human": "${BACKUP_SIZE_HUMAN}",
  "s3_bucket": "${S3_BUCKET}",
  "s3_key": "${S3_KEY}",
  "s3_url": "${S3_URL}",
  "checksum": "${CHECKSUM}",
  "zip_filename": "${ZIP_FILENAME}",
  "exit_code": ${EXIT_CODE},
  "error_message": $([ -n "$clean_error" ] && echo "\"${clean_error}\"" || echo "null")
}
EOF
)

# ------------------------------------------------------------------------------
# 5. DISPATCH SINGLE ENTRY VIA CURL
# ------------------------------------------------------------------------------
echo "=================================================================="
echo " 📡 Sending Single Backup Entry to BackupPulse"
echo "=================================================================="
echo " Project:  ${PROJECT_NAME}"
echo " Type:     ${BACKUP_TYPE}"
echo " Status:   ${STATUS}"
echo " Endpoint: ${HUB_API_URL}"
echo "------------------------------------------------------------------"

# Execute single curl POST request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${HUB_API_URL}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${HUB_API_KEY}" \
  -d "${JSON_PAYLOAD}")

# Extract HTTP status code and response body
HTTP_BODY=$(echo "$RESPONSE" | sed -e '$d')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

echo "Response Body: ${HTTP_BODY}"

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "------------------------------------------------------------------"
  echo " ✅ SUCCESS: Telemetry report recorded in BackupPulse (HTTP ${HTTP_STATUS})"
  echo "=================================================================="
  exit 0
else
  echo "------------------------------------------------------------------"
  echo " ❌ ERROR: Failed to deliver telemetry report (HTTP ${HTTP_STATUS})"
  echo "=================================================================="
  exit 1
fi

# ==============================================================================
# 💡 COPY-PASTE SNIPPET FOR ADMINS (Put this directly into your existing script):
# ==============================================================================
#
# # 1. Record start timestamp at beginning of backup:
# BKP_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# # 2. Run your backup commands here...
# #    mysqldump -u root my_db > /tmp/backup.sql
# #    tar -czf /tmp/my_backup.tar.gz /tmp/backup.sql
# #    aws s3 cp /tmp/my_backup.tar.gz s3://my-bucket/backups/
# BKP_STATUS=$?
#
# # 3. Record end timestamp and send report:
# BKP_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# [ $BKP_STATUS -eq 0 ] && STATUS_TXT="SUCCESS" || STATUS_TXT="FAILED"
#
# curl -s -X POST "http://your-backuppulse-hub:3000/api/v1/backups/report" \
#   -H "Content-Type: application/json" \
#   -H "x-api-key: bkp_live_secret_key_12345" \
#   -d "{
#     \"server_id\": \"$(hostname -s)\",
#     \"hostname\": \"$(hostname -f)\",
#     \"project_name\": \"my-database\",
#     \"backup_type\": \"db\",
#     \"status\": \"$STATUS_TXT\",
#     \"start_time\": \"$BKP_START\",
#     \"end_time\": \"$BKP_END\",
#     \"zip_filename\": \"my_backup.tar.gz\"
#   }"
# ==============================================================================
