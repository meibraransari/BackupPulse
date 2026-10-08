#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Dedicated MySQL S3 Backup & Telemetry Client
# ==============================================================================
# Purpose:
#   Performs automated MySQL / MariaDB database dumps using mysqldump, compresses to zip,
#   validates file size thresholds (anomaly guard), synchronizes archives to AWS S3,
#   prunes historical S3 backups based on retention policy, and dispatches real-time
#   structured telemetry directly to the central BackupPulse monitoring hub API.
#
# Prerequisites on Client Server:
#   Debian / Ubuntu:
#      sudo apt update
#      sudo apt install -y default-mysql-client zip unzip jq awscli curl
#   RHEL / CentOS / Rocky Linux:
#      sudo yum install -y mysql zip unzip jq awscli curl
#
# Setup Instructions:
#   1. Create the backup staging directory and set appropriate permissions:
#      sudo mkdir -p /var/backups/mysql
#      sudo chmod 777 /var/backups/mysql
#
#   2. Ensure AWS credentials are configured (IAM role, ~/.aws/credentials, or ENV).
#
#   3. Make this script executable:
#      chmod +x /opt/scripts/mysql_s3_backup.sh
#
#   4. Add to Crontab (e.g. daily at 02:00 AM):
#      0 2 * * * /opt/scripts/mysql_s3_backup.sh >> /var/log/mysql_backup.log 2>&1
#
# Usage:
#   ./mysql_s3_backup.sh [OPTIONS]
#   ./mysql_s3_backup.sh --project "ecommerce-db" --db-name "shop_prod"
# ==============================================================================

set -uo pipefail

# Set default file creation mask
umask 133

# ------------------------------------------------------------------------------
# 1. DEFAULT CONFIGURATION (Overridable via ENV or CLI arguments)
# ------------------------------------------------------------------------------
# BackupPulse Central Monitoring Hub
HUB_API_URL="${BACKUP_HUB_URL:-http://localhost:3000/api/v1/backups/report}"
HUB_API_KEY="${BACKUP_API_KEY:-bkp_live_secret_key_12345}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Project & Database Configuration
PROJECT_NAME="${PROJECT_NAME:-MySQL_App}"
DB_USER="${MYSQL_USER:-${DB_USER:-root}}"
DB_PASSWORD="${MYSQL_PWD:-${MYSQL_PASSWORD:-${DB_PASSWORD:-SecretPass123}}}"
DB_HOST="${MYSQL_HOST:-${DB_HOST:-127.0.0.1}}"
DB_PORT="${MYSQL_PORT:-${DB_PORT:-3306}}"
DB_NAME="${MYSQL_DATABASE:-${DB_NAME:-app_prod}}"
ALL_DATABASES="${ALL_DATABASES:-false}"
S3_FOLDER_NAME="${S3_FOLDER_NAME:-mysql_db_backup}"

# AWS S3 Storage & Retention Policy
S3_BUCKET="${S3_BUCKET:-my-mysql-backup-vault}"
MAX_FILES="${MAX_FILES:-30}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MIN_FILE_SIZE="${MIN_FILE_SIZE:-$((35 * 1024))}" # 35KB Minimum Threshold

# Local Storage Path
BACKUP_PATH="${BACKUP_PATH:-/var/backups/mysql}"

# Runtime Flags
DRY_RUN=false

# Server Telemetry Identification
SERVER_ID="${SERVER_ID:-$(hostname -s 2>/dev/null || echo 'server-unknown')}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# ------------------------------------------------------------------------------
# 2. CLI ARGUMENT PARSER
# ------------------------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_NAME="$2"; shift 2 ;;
    --db-user|--user) DB_USER="$2"; shift 2 ;;
    --db-password|--password) DB_PASSWORD="$2"; shift 2 ;;
    --db-host|--host) DB_HOST="$2"; shift 2 ;;
    --db-port|--port) DB_PORT="$2"; shift 2 ;;
    --db-name|--db) DB_NAME="$2"; shift 2 ;;
    --all-databases) ALL_DATABASES=true; shift ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-folder) S3_FOLDER_NAME="$2"; shift 2 ;;
    --max-files) MAX_FILES="$2"; shift 2 ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    --min-size-kb) MIN_FILE_SIZE="$(( $2 * 1024 ))"; shift 2 ;;
    --backup-path) BACKUP_PATH="$2"; shift 2 ;;
    --api-url) HUB_API_URL="$2"; shift 2 ;;
    --api-key) HUB_API_KEY="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    --env) ENVIRONMENT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help|-h)
      echo "BackupPulse MySQL S3 Backup & Telemetry Client"
      echo ""
      echo "Usage: $0 [options]"
      echo "  --project <name>        Project name (default: MySQL_App)"
      echo "  --db-user <user>        MySQL username (default: root)"
      echo "  --db-password <pass>    MySQL password"
      echo "  --db-host <host>        MySQL host (default: 127.0.0.1)"
      echo "  --db-port <port>        MySQL port (default: 3306)"
      echo "  --db-name <name>        MySQL database name (default: app_prod)"
      echo "  --all-databases         Dump all MySQL databases (--all-databases)"
      echo "  --s3-bucket <bucket>    AWS S3 Bucket name (default: my-mysql-backup-vault)"
      echo "  --s3-folder <folder>    S3 Destination Folder (default: mysql_db_backup)"
      echo "  --max-files <count>     Maximum files to retain in S3 (default: 30)"
      echo "  --retention-days <days> Retention period in days for availability tracking (default: 30)"
      echo "  --min-size-kb <kb>      Minimum file size threshold in KB (default: 35)"
      echo "  --backup-path <path>    Local dump staging path (default: /var/backups/mysql)"
      echo "  --api-url <url>         BackupPulse API Endpoint"
      echo "  --api-key <key>         BackupPulse Ingestion API Key"
      echo "  --server-id <id>        Override server ID (default: hostname -s)"
      echo "  --env <environment>     Environment tag (default: production)"
      echo "  --dry-run               Simulate backup without calling mysqldump, S3, or API"
      echo "  --help, -h              Display this help message"
      exit 0
      ;;
    *)
      echo "[-] Unknown argument: $1"
      echo "Run with --help for usage details."
      exit 1
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 3. INITIALIZATION & LOG BUFFERS
# ------------------------------------------------------------------------------
DATE_STR="$(date +"%d-%b-%Y_%H-%M")"
START_TIME_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_SECONDS="$(date +%s)"

TARGET_NAME="$DB_NAME"
[ "$ALL_DATABASES" = true ] && TARGET_NAME="all_databases"

SQL_FILENAME="${TARGET_NAME}-${DATE_STR}.sql"
ZIP_FILENAME="${TARGET_NAME}-${DATE_STR}.zip"
SQL_FILE="${BACKUP_PATH}/${SQL_FILENAME}"
ZIP_FILE="${BACKUP_PATH}/${ZIP_FILENAME}"

S3_KEY="${S3_FOLDER_NAME}/${ZIP_FILENAME}"
S3_URL="s3://${S3_BUCKET}/${S3_KEY}"

# Temporary log capture files
TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" 2>/dev/null || TEMP_LOG_DIR="/tmp"
LOG_STDOUT="${TEMP_LOG_DIR}/mysql_backup_${DATE_STR}.stdout.log"
LOG_STDERR="${TEMP_LOG_DIR}/mysql_backup_${DATE_STR}.stderr.log"
: > "$LOG_STDOUT"
: > "$LOG_STDERR"

echo "=================================================================="
echo " 🐬 BackupPulse — MySQL Backup & Telemetry Dispatcher"
echo "=================================================================="
echo " Project:       ${PROJECT_NAME}"
echo " Database:      $([ "$ALL_DATABASES" = true ] && echo 'ALL DATABASES' || echo "${DB_NAME}") (${DB_HOST}:${DB_PORT})"
echo " Database User: ${DB_USER}"
echo " Local Staging: ${BACKUP_PATH}"
echo " S3 Target:     ${S3_URL}"
echo " Max Retention: ${MAX_FILES} archives in S3 (${RETENTION_DAYS} days policy)"
echo " Retention Days: ${RETENTION_DAYS} days"
echo " Min Size:      $(( MIN_FILE_SIZE / 1024 )) KB"
echo " Hub Endpoint:  ${HUB_API_URL}"
echo " Timestamp:     ${START_TIME_ISO}"
echo "=================================================================="

# Helper: Human-readable size converter
format_bytes() {
  local bytes="${1:-0}"
  if (( bytes < 1024 )); then
    echo "${bytes} B"
  elif (( bytes < 1048576 )); then
    echo "$(( (bytes + 1023) / 1024 )) KB"
  elif (( bytes < 1073741824 )); then
    echo "$(( (bytes + 1048575) / 1048576 )) MB"
  else
    echo "$(( (bytes + 1073741823) / 1073741824 )) GB"
  fi
}

# ------------------------------------------------------------------------------
# 4. TELEMETRY DISPATCH FUNCTION (Sends Realtime Data to BackupPulse API)
# ------------------------------------------------------------------------------
send_telemetry() {
  local status="$1"            # SUCCESS, FAILED, WARNING, IN_PROGRESS
  local exit_code="$2"         # 0 or 1
  local error_msg="$3"         # Descriptive error or status message
  local size_bytes="${4:-0}"   # Exact archive size in bytes
  local checksum="${5:-}"      # SHA256 checksum
  local s3_key="${6:-}"        # S3 object key
  local s3_url="${7:-}"        # Full S3 URI
  local zip_name="${8:-$ZIP_FILENAME}"
  local meta_json="${9:-}"
  [ -z "$meta_json" ] && meta_json="{}"

  local end_seconds="$(date +%s)"
  local duration_seconds="$(( end_seconds - START_SECONDS ))"
  local end_time_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local size_human="$(format_bytes "$size_bytes")"

  # Extract tail of stdout and stderr logs for diagnostic inspection in web UI
  local stdout_snip=""
  local stderr_snip=""
  if [ -f "$LOG_STDOUT" ] && [ -s "$LOG_STDOUT" ]; then
    stdout_snip="$(tail -n 100 "$LOG_STDOUT" | head -c 16384)"
  fi
  if [ -f "$LOG_STDERR" ] && [ -s "$LOG_STDERR" ]; then
    stderr_snip="$(tail -n 100 "$LOG_STDERR" | head -c 16384)"
  fi

  # Safely construct JSON payload using jq if available
  local payload=""
  if command -v jq >/dev/null 2>&1; then
    payload=$(jq -n \
      --arg server_id "$SERVER_ID" \
      --arg hostname "$HOSTNAME_FQDN" \
      --arg server_ip "$SERVER_IP" \
      --arg project_name "$PROJECT_NAME" \
      --arg environment "$ENVIRONMENT" \
      --arg backup_type "db" \
      --arg status "$status" \
      --arg start_time "$START_TIME_ISO" \
      --arg end_time "$end_time_iso" \
      --argjson duration_seconds "$duration_seconds" \
      --argjson backup_size_bytes "$size_bytes" \
      --arg backup_size_human "$size_human" \
      --arg s3_bucket "$S3_BUCKET" \
      --arg s3_key "$s3_key" \
      --arg s3_url "$s3_url" \
      --arg checksum "$checksum" \
      --arg zip_filename "$zip_name" \
      --argjson exit_code "$exit_code" \
      --argjson retention_days "$RETENTION_DAYS" \
      --arg error_message "$error_msg" \
      --arg stdout_log "$stdout_snip" \
      --arg stderr_log "$stderr_snip" \
      --argjson metadata "$meta_json" \
      '{
        server_id: $server_id,
        hostname: $hostname,
        server_ip: $server_ip,
        project_name: $project_name,
        environment: $environment,
        backup_type: $backup_type,
        status: $status,
        start_time: $start_time,
        end_time: $end_time,
        duration_seconds: $duration_seconds,
        backup_size_bytes: $backup_size_bytes,
        backup_size_human: $backup_size_human,
        s3_bucket: (if $s3_bucket == "" then null else $s3_bucket end),
        s3_key: (if $s3_key == "" then null else $s3_key end),
        s3_url: (if $s3_url == "" then null else $s3_url end),
        checksum: (if $checksum == "" then null else $checksum end),
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end),
        stdout_log: (if $stdout_log == "" then null else $stdout_log end),
        stderr_log: (if $stderr_log == "" then null else $stderr_log end),
        metadata: $metadata
      }')
  else
    # Fallback string escaping for minimal environments
    local clean_error="$(echo "$error_msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g')"
    local clean_stdout="$(echo "$stdout_snip" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g')"
    local clean_stderr="$(echo "$stderr_snip" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g')"
    payload=$(cat <<EOF
{
  "server_id": "${SERVER_ID}",
  "hostname": "${HOSTNAME_FQDN}",
  "server_ip": "${SERVER_IP}",
  "project_name": "${PROJECT_NAME}",
  "environment": "${ENVIRONMENT}",
  "backup_type": "db",
  "status": "${status}",
  "start_time": "${START_TIME_ISO}",
  "end_time": "${end_time_iso}",
  "duration_seconds": ${duration_seconds},
  "backup_size_bytes": ${size_bytes},
  "backup_size_human": "${size_human}",
  "s3_bucket": "${S3_BUCKET}",
  "s3_key": "${s3_key}",
  "s3_url": "${s3_url}",
  "checksum": "${checksum}",
  "zip_filename": "${zip_name}",
  "exit_code": ${exit_code},
  "retention_days": ${RETENTION_DAYS},
  "error_message": $([ -n "$clean_error" ] && echo "\"${clean_error}\"" || echo "null"),
  "stdout_log": $([ -n "$clean_stdout" ] && echo "\"${clean_stdout}\"" || echo "null"),
  "stderr_log": $([ -n "$clean_stderr" ] && echo "\"${clean_stderr}\"" || echo "null"),
  "metadata": ${meta_json}
}
EOF
)
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would post JSON telemetry to ${HUB_API_URL}:"
    echo "$payload"
    return 0
  fi

  echo ""
  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  local api_resp
  api_resp="$(curl -s -S -w "\nHTTP_STATUS:%{http_code}" -X POST "${HUB_API_URL}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${HUB_API_KEY}" \
    --data "$payload" \
    --connect-timeout 10 \
    --max-time 30 \
    --retry 3 \
    --retry-delay 2 2>&1 || true)"

  local http_code="$(echo "$api_resp" | grep "HTTP_STATUS:" | cut -d':' -f2)"
  local resp_body="$(echo "$api_resp" | sed -e '$d')"

  if [[ "$http_code" =~ ^20[0-9]$ ]]; then
    echo "✅ Telemetry successfully recorded in BackupPulse (HTTP ${http_code})"
    echo "   Server Response: ${resp_body}"
  else
    echo "⚠️ Warning: Failed to deliver telemetry to BackupPulse (HTTP ${http_code:-000})"
    echo "   Error Output: ${api_resp}" >&2
  fi
}

# Cleanup temporary files on exit
cleanup() {
  rm -f "$LOG_STDOUT" "$LOG_STDERR" 2>/dev/null || true
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 5. PRE-FLIGHT SYSTEM CHECKS
# ------------------------------------------------------------------------------
if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Simulating system dependency checks (mysqldump, zip, jq, aws, curl)..."
else
  MISSING_DEPS=()
  for cmd in mysqldump zip jq aws curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      MISSING_DEPS+=("$cmd")
    fi
  done

  if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    DEP_ERR="Missing required system dependencies: ${MISSING_DEPS[*]}. Please run: sudo apt install -y default-mysql-client zip jq awscli curl"
    echo "[-] ERROR: $DEP_ERR" >&2
    echo "$DEP_ERR" >> "$LOG_STDERR"
    send_telemetry "FAILED" 1 "$DEP_ERR" 0 "" "" "" "$ZIP_FILENAME" "{\"dependency_error\": true}"
    exit 1
  fi
fi

# Ensure staging path exists and is writable
if ! mkdir -p "$BACKUP_PATH" 2>/dev/null; then
  DIR_ERR="Cannot create backup directory '${BACKUP_PATH}'. Check permissions (sudo mkdir -p ${BACKUP_PATH} && sudo chmod 777 ${BACKUP_PATH})."
  echo "[-] ERROR: $DIR_ERR" >&2
  echo "$DIR_ERR" >> "$LOG_STDERR"
  send_telemetry "FAILED" 1 "$DIR_ERR" 0 "" "" "" "$ZIP_FILENAME" "{}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 6. EXECUTE MYSQL DATABASE DUMP
# ------------------------------------------------------------------------------
echo ""
echo "🚀 [1/5] Removing old local dump archives in ${BACKUP_PATH}..."
rm -f "$BACKUP_PATH"/*.zip "$BACKUP_PATH"/*.sql 2>/dev/null || true

echo "🐬 [2/5] Dumping MySQL database '$([ "$ALL_DATABASES" = true ] && echo 'ALL DATABASES' || echo "$DB_NAME")' from ${DB_HOST}:${DB_PORT}..."

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Simulating mysqldump into ${SQL_FILE}"
  touch "$SQL_FILE"
  echo "Simulated MySQL Dump Content" > "$SQL_FILE"
  DUMP_EXIT=0
else
  # Use MYSQL_PWD environment variable to prevent insecure CLI password warning
  if [ "$ALL_DATABASES" = true ]; then
    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      --all-databases > "$SQL_FILE" 2> >(tee -a "$LOG_STDERR" >&2)
    DUMP_EXIT=$?
  else
    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      "$DB_NAME" > "$SQL_FILE" 2> >(tee -a "$LOG_STDERR" >&2)
    DUMP_EXIT=$?
  fi
fi

if [ $DUMP_EXIT -ne 0 ] || [ ! -f "$SQL_FILE" ]; then
  DUMP_ERR_MSG="Error: ${PROJECT_NAME}_MySQL backup failed during SQL dump creation. (Exit code: ${DUMP_EXIT})"
  echo "[-] ${DUMP_ERR_MSG}" >&2

  if command -v jq >/dev/null 2>&1; then
    META_JSON=$(jq -n \
      --arg db_host "$DB_HOST" \
      --arg db_port "$DB_PORT" \
      --arg db_name "$DB_NAME" \
      --arg db_user "$DB_USER" \
      --arg step "mysqldump" \
      '{db_engine: "mysql", db_host: $db_host, db_port: $db_port, db_name: $db_name, db_user: $db_user, failed_step: $step}')
  else
    META_JSON="{\"db_engine\": \"mysql\", \"db_host\": \"${DB_HOST}\", \"db_port\": \"${DB_PORT}\", \"db_name\": \"${DB_NAME}\", \"db_user\": \"${DB_USER}\", \"failed_step\": \"mysqldump\"}"
  fi

  send_telemetry "FAILED" "$DUMP_EXIT" "$DUMP_ERR_MSG" 0 "" "" "" "$SQL_FILENAME" "$META_JSON"
  exit 1
fi
echo "✅ MySQL dump completed successfully."

# ------------------------------------------------------------------------------
# 7. ZIP SQL FILE AND REMOVE RAW DUMP
# ------------------------------------------------------------------------------
echo "📦 [3/5] Compressing SQL dump into archive: ${ZIP_FILE}..."
if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Simulating zip compression"
  echo "Simulated MySQL Zip Payload" > "$ZIP_FILE"
  rm -f "$SQL_FILE"
else
  zip -r9 "$ZIP_FILE" "$SQL_FILE" > >(tee -a "$LOG_STDOUT") 2> >(tee -a "$LOG_STDERR" >&2)
  ZIP_EXIT=$?
  rm -f "$SQL_FILE" 2>/dev/null || true

  if [ $ZIP_EXIT -ne 0 ] || [ ! -f "$ZIP_FILE" ]; then
    ZIP_ERR_MSG="Error: ${PROJECT_NAME}_MySQL backup failed during zip compression. (Exit code: ${ZIP_EXIT})"
    echo "[-] ${ZIP_ERR_MSG}" >&2
    send_telemetry "FAILED" "$ZIP_EXIT" "$ZIP_ERR_MSG" 0 "" "" "" "$ZIP_FILENAME" "{\"failed_step\": \"zip\"}"
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# 8. ANOMALY DETECTION: VALIDATE FILE SIZE & COMPUTE CHECKSUM
# ------------------------------------------------------------------------------
LATEST_FILE_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || wc -c < "$ZIP_FILE" 2>/dev/null || echo 0)
LATEST_FILE_HUMAN="$(format_bytes "$LATEST_FILE_SIZE")"
CHECKSUM="$(sha256sum "$ZIP_FILE" 2>/dev/null | awk '{print $1}' || echo '')"

echo "📊 Archive Size: ${LATEST_FILE_SIZE} bytes (${LATEST_FILE_HUMAN})"
echo "🔒 SHA256 Hash:   ${CHECKSUM:-None}"

STATUS="SUCCESS"
IS_ANOMALY=false
STATUS_MESSAGE="${PROJECT_NAME}_MySQL backup completed successfully and uploaded to S3."

if [ "$LATEST_FILE_SIZE" -lt "$MIN_FILE_SIZE" ]; then
  STATUS="WARNING"
  IS_ANOMALY=true
  STATUS_MESSAGE="Warning: ${PROJECT_NAME}_MySQL backup size (${LATEST_FILE_SIZE} bytes / ${LATEST_FILE_HUMAN}) is smaller than minimum threshold (${MIN_FILE_SIZE} bytes)."
  echo "⚠️  ANOMALY DETECTED: ${STATUS_MESSAGE}"
fi

# ------------------------------------------------------------------------------
# 9. UPLOAD TO AWS S3 BUCKET
# ------------------------------------------------------------------------------
echo "☁️  [4/5] Uploading backup directory to AWS S3: s3://${S3_BUCKET}/${S3_FOLDER_NAME}..."
if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Simulating AWS S3 copy: aws s3 cp ${BACKUP_PATH}/ s3://${S3_BUCKET}/${S3_FOLDER_NAME} --recursive"
else
  aws s3 cp "$BACKUP_PATH/" "s3://${S3_BUCKET}/${S3_FOLDER_NAME}" --recursive > >(tee -a "$LOG_STDOUT") 2> >(tee -a "$LOG_STDERR" >&2)
  S3_EXIT=$?

  if [ $S3_EXIT -ne 0 ]; then
    S3_ERR_MSG="Error: ${PROJECT_NAME}_MySQL backup completed locally but S3 upload failed. (Exit code: ${S3_EXIT})"
    echo "[-] ${S3_ERR_MSG}" >&2

    if command -v jq >/dev/null 2>&1; then
      META_JSON=$(jq -n \
        --arg s3_bucket "$S3_BUCKET" \
        --arg s3_folder "$S3_FOLDER_NAME" \
        --arg step "s3_upload" \
        '{s3_bucket: $s3_bucket, s3_folder: $s3_folder, failed_step: $step}')
    else
      META_JSON="{\"s3_bucket\": \"${S3_BUCKET}\", \"s3_folder\": \"${S3_FOLDER_NAME}\", \"failed_step\": \"s3_upload\"}"
    fi

    send_telemetry "FAILED" "$S3_EXIT" "$S3_ERR_MSG" "$LATEST_FILE_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL" "$ZIP_FILENAME" "$META_JSON"
    exit 1
  fi
fi
echo "✅ S3 upload completed successfully."

# ------------------------------------------------------------------------------
# 10. S3 RETENTION & PRUNING (Maintain max historical files)
# ------------------------------------------------------------------------------
echo "🧹 [5/5] Checking S3 retention policy (Keep max ${MAX_FILES} files)..."
FILES_COUNT=0
FILES_DELETED=0
PRUNED_FILES_JSON="[]"

if [ "$DRY_RUN" = false ]; then
  # List files in JSON format from S3
  FILES_JSON="$(aws s3 ls "s3://${S3_BUCKET}/${S3_FOLDER_NAME}" --recursive 2>>"$LOG_STDERR" | awk '{print "{\"date\":\""$1" "$2"\", \"filename\":\""$4"\"}"}' | jq -s '.' 2>/dev/null || echo '[]')"

  if [ -n "$FILES_JSON" ] && echo "$FILES_JSON" | jq empty 2>/dev/null; then
    FILES_JSON_SORTED="$(echo "$FILES_JSON" | jq -c 'sort_by(.date)')"
    FILES_COUNT="$(echo "$FILES_JSON_SORTED" | jq 'length')"
    echo "ℹ️  Total files in S3 vault folder: ${FILES_COUNT}"

    if [ "$FILES_COUNT" -gt "$MAX_FILES" ]; then
      DIFF_COUNT="$(( FILES_COUNT - MAX_FILES ))"
      FILES_TO_DELETE="$(echo "$FILES_JSON_SORTED" | jq -c ".[:$DIFF_COUNT]")"
      FILES_DELETED="$(echo "$FILES_TO_DELETE" | jq '. | length')"
      PRUNED_FILES_JSON="$FILES_TO_DELETE"

      echo "⚠️  Retention threshold exceeded. Pruning ${FILES_DELETED} oldest archive(s) from S3..."

      # Iterate and delete obsolete archives from S3
      echo "$FILES_TO_DELETE" | jq -c '.[]' | while IFS= read -r item; do
        FILE_REL_NAME="$(echo "$item" | jq -r '.filename')"
        FULL_S3_DEL_PATH="s3://${S3_BUCKET}/${FILE_REL_NAME}"
        echo "   🗑️ Deleting obsolete archive: ${FULL_S3_DEL_PATH}"
        aws s3 rm "$FULL_S3_DEL_PATH" >/dev/null 2>&1 || echo "   Failed to delete ${FULL_S3_DEL_PATH}"
      done
    else
      echo "ℹ️  No files need to be deleted. Total files: ${FILES_COUNT}, Max allowed: ${MAX_FILES}"
    fi
  else
    echo "⚠️  Could not parse S3 file listing JSON for pruning. Skipping retention cleanup."
  fi
else
  echo "[DRY-RUN] Simulating S3 retention pruning"
fi

# ------------------------------------------------------------------------------
# 11. DISPATCH FINAL REAL-TIME TELEMETRY TO BACKUPPULSE
# ------------------------------------------------------------------------------
if command -v jq >/dev/null 2>&1; then
  FINAL_META=$(jq -n \
    --arg agent "mysql_s3_backup" \
    --arg db_engine "mysql" \
    --arg db_host "$DB_HOST" \
    --arg db_port "$DB_PORT" \
    --arg db_name "$DB_NAME" \
    --arg db_user "$DB_USER" \
    --arg s3_folder "$S3_FOLDER_NAME" \
    --argjson min_threshold_bytes "$MIN_FILE_SIZE" \
    --argjson max_files_retention "$MAX_FILES" \
    --argjson retention_days "$RETENTION_DAYS" \
    --argjson s3_total_files "$FILES_COUNT" \
    --argjson s3_files_pruned "$FILES_DELETED" \
    --argjson is_anomaly "$IS_ANOMALY" \
    --arg status_msg "$STATUS_MESSAGE" \
    --argjson pruned_files "$PRUNED_FILES_JSON" \
    '{
      agent_name: $agent,
      db_engine: $db_engine,
      db_host: $db_host,
      db_port: $db_port,
      db_name: $db_name,
      db_user: $db_user,
      s3_folder: $s3_folder,
      min_size_threshold_bytes: $min_threshold_bytes,
      max_files_retention: $max_files_retention,
      retention_days: $retention_days,
      s3_total_files: $s3_total_files,
      s3_files_pruned: $s3_files_pruned,
      anomaly_detected: $is_anomaly,
      status_summary: $status_msg,
      pruned_files_history: $pruned_files
    }')
else
  CLEAN_STATUS_MSG="$(echo "$STATUS_MESSAGE" | sed 's/"/\\"/g')"
  FINAL_META="{\"agent_name\": \"mysql_s3_backup\", \"db_engine\": \"mysql\", \"db_host\": \"${DB_HOST}\", \"db_port\": \"${DB_PORT}\", \"db_name\": \"${DB_NAME}\", \"db_user\": \"${DB_USER}\", \"s3_folder\": \"${S3_FOLDER_NAME}\", \"min_size_threshold_bytes\": ${MIN_FILE_SIZE}, \"max_files_retention\": ${MAX_FILES}, \"retention_days\": ${RETENTION_DAYS}, \"s3_total_files\": ${FILES_COUNT}, \"s3_files_pruned\": ${FILES_DELETED}, \"anomaly_detected\": ${IS_ANOMALY}, \"status_summary\": \"${CLEAN_STATUS_MSG}\"}"
fi

send_telemetry \
  "$STATUS" \
  0 \
  "$STATUS_MESSAGE" \
  "$LATEST_FILE_SIZE" \
  "$CHECKSUM" \
  "$S3_KEY" \
  "$S3_URL" \
  "$ZIP_FILENAME" \
  "$FINAL_META"

echo ""
echo "=================================================================="
echo " 🎉 Backup Process Completed Successfully!"
echo " Status:           ${STATUS}"
echo " Archive File:     ${ZIP_FILENAME} (${LATEST_FILE_HUMAN})"
echo " S3 Destination:   ${S3_URL}"
echo " S3 Total Files:   ${FILES_COUNT}"
echo " S3 Files Pruned:  ${FILES_DELETED}"
echo " Anomaly Detected: ${IS_ANOMALY}"
echo " Execution Time:   $(( $(date +%s) - START_SECONDS )) seconds"
echo "=================================================================="

exit 0
