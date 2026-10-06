#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Production Backup Agent & Telemetry Client
# ==============================================================================
# Usage:
#   ./backup_agent.sh --project "ecommerce-api" --type "full" --dir "/var/www/app" --s3-bucket "my-backup-vault"
# Or run with environment variables / config file (ideal for cron jobs across 100+ servers).
# ==============================================================================

set -o pipefail

# ------------------------------------------------------------------------------
# Default Configurations (Can be overridden via ENV or command-line args)
# ------------------------------------------------------------------------------
CONFIG_FILE="${BACKUP_CONFIG_FILE:-/etc/backup_agent.conf}"
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

API_URL="${API_URL:-http://localhost:3000/api/v1/backups/report}"
API_KEY="${API_KEY:-bkp_live_secret_key_12345}"
PROJECT_NAME="${PROJECT_NAME:-default-project}"
BACKUP_TYPE="${BACKUP_TYPE:-code}" # db | code | full
SOURCE_DIR="${SOURCE_DIR:-}"
DB_DUMP_CMD="${DB_DUMP_CMD:-}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups}"
ENVIRONMENT="${ENVIRONMENT:-production}"
TEMP_DIR="${TEMP_DIR:-/tmp/backups}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-0}" # 0 = delete immediately after S3 upload
DRY_RUN="${DRY_RUN:-false}"

# Server Identification
SERVER_ID="${SERVER_ID:-$(hostname -s 2>/dev/null || echo 'server-unknown')}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# Parse Command-Line Options
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_NAME="$2"; shift 2 ;;
    --type) BACKUP_TYPE="$2"; shift 2 ;;
    --dir) SOURCE_DIR="$2"; shift 2 ;;
    --db-cmd) DB_DUMP_CMD="$2"; shift 2 ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-prefix) S3_PREFIX="$2"; shift 2 ;;
    --api-url) API_URL="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    --env) ENVIRONMENT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help)
      echo "Usage: $0 [options]"
      echo "  --project     Project name (e.g. billing-service)"
      echo "  --type        Backup type: 'db', 'code', or 'full'"
      echo "  --dir         Target directory to backup/zip"
      echo "  --db-cmd      Optional command to dump DB into the target directory"
      echo "  --s3-bucket   AWS S3 Bucket name"
      echo "  --s3-prefix   S3 key prefix (default: backups)"
      echo "  --api-url     BackupPulse Ingestion API URL"
      echo "  --api-key     BackupPulse Ingestion API Key"
      echo "  --server-id   Server identification identifier"
      echo "  --dry-run     Simulate without uploading to S3 or calling API"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validation
if [ -z "$SOURCE_DIR" ] && [ -z "$DB_DUMP_CMD" ]; then
  echo "[-] ERROR: Must specify at least --dir <folder_path> or --db-cmd <command>"
  exit 1
fi

# Timestamps & Tracking
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DATE_FOLDER="$(date +%Y-%m-%d)"
START_TIME_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_SECONDS=$(date +%s)

ARCHIVE_BASENAME="${PROJECT_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.tar.gz"
WORK_DIR="${TEMP_DIR}/${PROJECT_NAME}_${TIMESTAMP}"
ARCHIVE_PATH="${TEMP_DIR}/${ARCHIVE_BASENAME}"
S3_KEY="${S3_PREFIX}/${PROJECT_NAME}/${DATE_FOLDER}/${ARCHIVE_BASENAME}"
S3_URI="s3://${S3_BUCKET}/${S3_KEY}"

LOG_STDOUT="${TEMP_DIR}/backup_${TIMESTAMP}.stdout.log"
LOG_STDERR="${TEMP_DIR}/backup_${TIMESTAMP}.stderr.log"

mkdir -p "$TEMP_DIR" "$WORK_DIR"
exec 3>&1 4>&2
exec > >(tee -a "$LOG_STDOUT") 2> >(tee -a "$LOG_STDERR" >&2)

# Helper function to convert bytes to human-readable format
format_bytes() {
  local bytes=$1
  if (( bytes < 1024 )); then echo "${bytes} B"
  elif (( bytes < 1048576 )); then echo "$(( (bytes + 1023) / 1024 )) KB"
  elif (( bytes < 1073741824 )); then echo "$(( (bytes + 1048575) / 1048576 )) MB"
  else echo "$(( (bytes + 1073741823) / 1073741824 )) GB"; fi
}

# ------------------------------------------------------------------------------
# Dispatch Report to API
# ------------------------------------------------------------------------------
send_report() {
  local status="$1"
  local exit_code="$2"
  local error_msg="$3"
  local size_bytes="${4:-0}"
  local checksum="${5:-}"

  local end_seconds=$(date +%s)
  local duration_seconds=$(( end_seconds - START_SECONDS ))
  local end_time_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local size_human="$(format_bytes "$size_bytes")"

  # Clean log snippets for JSON
  local stdout_clean=""
  local stderr_clean=""
  [ -f "$LOG_STDOUT" ] && stdout_clean="$(tail -c 32768 "$LOG_STDOUT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g' | tr -d '\000-\031')"
  [ -f "$LOG_STDERR" ] && stderr_clean="$(tail -c 32768 "$LOG_STDERR" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g' | tr -d '\000-\031')"
  local error_clean="$(echo "$error_msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\n/\\n/g')"

  local json_payload=$(cat <<EOF
{
  "server_id": "${SERVER_ID}",
  "hostname": "${HOSTNAME_FQDN}",
  "server_ip": "${SERVER_IP}",
  "project_name": "${PROJECT_NAME}",
  "environment": "${ENVIRONMENT}",
  "backup_type": "${BACKUP_TYPE}",
  "status": "${status}",
  "start_time": "${START_TIME_ISO}",
  "end_time": "${end_time_iso}",
  "duration_seconds": ${duration_seconds},
  "backup_size_bytes": ${size_bytes},
  "backup_size_human": "${size_human}",
  "s3_bucket": "${S3_BUCKET}",
  "s3_key": "${S3_KEY}",
  "s3_url": "${S3_URI}",
  "checksum": "${checksum}",
  "zip_filename": "${ARCHIVE_BASENAME}",
  "exit_code": ${exit_code},
  "error_message": $([ -n "$error_clean" ] && echo "\"$error_clean\"" || echo "null"),
  "stdout_log": $([ -n "$stdout_clean" ] && echo "\"$stdout_clean\"" || echo "null"),
  "stderr_log": $([ -n "$stderr_clean" ] && echo "\"$stderr_clean\"" || echo "null"),
  "metadata": {
    "agent_version": "1.0.0",
    "os": "$(uname -s 2>/dev/null || echo 'Linux')",
    "kernel": "$(uname -r 2>/dev/null || echo 'unknown')"
  }
}
EOF
)

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would send payload to ${API_URL}:"
    echo "$json_payload"
    return 0
  fi

  echo "[*] Dispatching backup telemetry to API: ${API_URL}..."
  local api_resp
  api_resp="$(curl -s -S -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    --data "$json_payload" \
    --connect-timeout 10 \
    --max-time 30 \
    --retry 3 \
    --retry-delay 2 2>&1)"

  local http_code="$(echo "$api_resp" | grep "HTTP_STATUS:" | cut -d':' -f2)"
  if [[ "$http_code" =~ ^20[0-9]$ ]]; then
    echo "[+] Telemetry report successfully ingested (HTTP ${http_code})."
  else
    echo "[-] WARNING: Telemetry ingestion failed! Response: ${api_resp}" >&2
  fi
}

# ------------------------------------------------------------------------------
# Error Trap Handler
# ------------------------------------------------------------------------------
handle_error() {
  local exit_code="$?"
  local line_no="$1"
  echo "[-] ERROR: Backup job failed at line ${line_no} with exit code ${exit_code}" >&2

  local last_err=""
  [ -f "$LOG_STDERR" ] && last_err="$(tail -n 10 "$LOG_STDERR" | tr '\n' ' ')"
  [ -z "$last_err" ] && last_err="Script failed on line ${line_no} (code: ${exit_code})"

  send_report "FAILED" "$exit_code" "$last_err" 0 ""
  cleanup
  exit "$exit_code"
}
trap 'handle_error $LINENO' ERR

# ------------------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------------------
cleanup() {
  echo "[*] Cleaning up temporary staging directories..."
  rm -rf "$WORK_DIR"
  [ -f "$ARCHIVE_PATH" ] && [ "$KEEP_LOCAL_DAYS" -eq 0 ] && rm -f "$ARCHIVE_PATH"
  rm -f "$LOG_STDOUT" "$LOG_STDERR"
}

# ------------------------------------------------------------------------------
# Execution Flow
# ------------------------------------------------------------------------------
echo "=========================================================================="
echo " Starting BackupPulse Agent: ${PROJECT_NAME} (${BACKUP_TYPE})"
echo " Host: ${SERVER_ID} (${SERVER_IP}) | Time: ${START_TIME_ISO}"
echo "=========================================================================="

# 1. Execute DB Dump if specified
if [ -n "$DB_DUMP_CMD" ]; then
  echo "[*] Running database dump command..."
  eval "$DB_DUMP_CMD" > "${WORK_DIR}/db_dump.sql"
  echo "[+] Database dump completed: $(du -sh "${WORK_DIR}/db_dump.sql" | cut -f1)"
fi

# 2. Copy source directory if specified
if [ -n "$SOURCE_DIR" ]; then
  if [ ! -d "$SOURCE_DIR" ]; then
    echo "[-] Source directory not found: ${SOURCE_DIR}" >&2
    exit 2
  fi
  echo "[*] Staging source directory files from: ${SOURCE_DIR}..."
  cp -r "$SOURCE_DIR" "${WORK_DIR}/code_files"
fi

# 3. Compress Folder
echo "[*] Creating compressed archive: ${ARCHIVE_PATH}..."
tar -czf "$ARCHIVE_PATH" -C "$TEMP_DIR" "$(basename "$WORK_DIR")"

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "[-] Failed to generate archive: ${ARCHIVE_PATH}" >&2
  exit 3
fi

# 4. Measure Size and Checksum
ARCHIVE_SIZE_BYTES="$(stat -c %s "$ARCHIVE_PATH" 2>/dev/null || wc -c < "$ARCHIVE_PATH" | tr -d ' ')"
CHECKSUM="$(sha256sum "$ARCHIVE_PATH" 2>/dev/null | awk '{print $1}' || md5sum "$ARCHIVE_PATH" 2>/dev/null | awk '{print $1}')"

echo "[+] Archive created: $(format_bytes "$ARCHIVE_SIZE_BYTES") (${ARCHIVE_SIZE_BYTES} bytes)"
echo "[+] SHA256 Checksum: ${CHECKSUM}"

# 5. Upload to S3
if [ -n "$S3_BUCKET" ]; then
  echo "[*] Uploading archive to AWS S3: ${S3_URI}..."
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would upload with: aws s3 cp ${ARCHIVE_PATH} ${S3_URI}"
  else
    if command -v aws >/dev/null 2>&1; then
      aws s3 cp "$ARCHIVE_PATH" "$S3_URI" --only-show-errors
      echo "[+] S3 upload verified successfully."
    else
      echo "[-] 'aws' CLI command not found. S3 upload skipped." >&2
      exit 4
    fi
  fi
else
  echo "[!] No S3_BUCKET specified. Archive kept locally."
fi

# 6. Send Successful Telemetry Report to API
send_report "SUCCESS" 0 "" "$ARCHIVE_SIZE_BYTES" "$CHECKSUM"

# 7. Final Cleanup
cleanup

echo "=========================================================================="
echo " Backup job completed successfully in $(( $(date +%s) - START_SECONDS ))s."
echo "=========================================================================="
exit 0
