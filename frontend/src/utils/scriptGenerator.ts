// ==============================================================================
// BackupPulse Script Generator Utility
// Generates ready-to-run, production-grade backup scripts and curl snippets
// ==============================================================================

export interface GeneratorConfig {
  backupType: 'postgres' | 'mysql' | 'zip' | 'curl';
  apiUrl: string;
  apiKey: string;
  projectName: string;
  serverId?: string;
  environment: string;
  retentionDays: number;
  maxFiles: number;
  minSizeKb: number;

  // Database specific
  dbUser?: string;
  dbPassword?: string;
  dbHost?: string;
  dbPort?: string;
  dbName?: string;
  allDatabases?: boolean;

  // Storage specific
  s3Bucket: string;
  s3Folder: string;
  backupPath: string;

  // Zip specific
  sourcePath?: string;
  excludePatterns?: string;

  // Cron schedule
  cronSchedule?: string;
}

export function generatePostgresScript(cfg: GeneratorConfig): string {
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_postgres_project';
  const dbUser = cfg.dbUser || 'postgres';
  const dbPass = cfg.dbPassword || 'DB_PASSWORD_HERE';
  const dbHost = cfg.dbHost || '127.0.0.1';
  const dbPort = cfg.dbPort || '5432';
  const dbName = cfg.dbName || 'my_database';
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_db_backup`;
  const backupPath = cfg.backupPath || '/var/backups/postgres';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — PostgreSQL S3 Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Database:      ${dbName} (${dbHost}:${dbPort})
# S3 Target:     s3://${s3Bucket}/${s3Folder}
# Retention:     ${retentionDays} days (${maxFiles} max archives)
# ==============================================================================

set -uo pipefail
umask 133

# --- Central Ingestion Hub ---
HUB_API_URL="\${BACKUP_HUB_URL:-${apiUrl}}"
HUB_API_KEY="\${BACKUP_API_KEY:-${apiKey}}"
ENVIRONMENT="\${ENVIRONMENT:-${cfg.environment || 'production'}}"

# --- PostgreSQL Credentials & Host ---
PROJECT_NAME="\${PROJECT_NAME:-${project}}"
DB_USER="\${PGUSER:-\${DB_USER:-${dbUser}}}"
DB_PASSWORD="\${PGPASSWORD:-\${DB_PASSWORD:-${dbPass}}}"
DB_HOST="\${PGHOST:-\${DB_HOST:-${dbHost}}}"
DB_PORT="\${PGPORT:-\${DB_PORT:-${dbPort}}}"
DB_NAME="\${PGDATABASE:-\${DB_NAME:-${dbName}}}"

# --- S3 Storage & Retention Policy ---
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path ---
BACKUP_PATH="\${BACKUP_PATH:-${backupPath}}"
DRY_RUN=false

# --- Server Identity ---
SERVER_ID="\${SERVER_ID:-${serverId}}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# CLI argument overrides
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_NAME="$2"; shift 2 ;;
    --db-user) DB_USER="$2"; shift 2 ;;
    --db-password) DB_PASSWORD="$2"; shift 2 ;;
    --db-host) DB_HOST="$2"; shift 2 ;;
    --db-port) DB_PORT="$2"; shift 2 ;;
    --db-name) DB_NAME="$2"; shift 2 ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-folder) S3_FOLDER_NAME="$2"; shift 2 ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    --max-files) MAX_FILES="$2"; shift 2 ;;
    --api-key) HUB_API_KEY="$2"; shift 2 ;;
    --api-url) HUB_API_URL="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

DATE_STR="$(date +"%d-%b-%Y_%H-%M")"
START_TIME_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_SECONDS="$(date +%s)"
SQL_FILENAME="\${DB_NAME}-\${DATE_STR}.sql"
ZIP_FILENAME="\${DB_NAME}-\${DATE_STR}.zip"
SQL_FILE="\${BACKUP_PATH}/\${SQL_FILENAME}"
ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" "$BACKUP_PATH" 2>/dev/null || true
LOG_STDOUT="\${TEMP_LOG_DIR}/pg_backup_\${DATE_STR}.stdout.log"
LOG_STDERR="\${TEMP_LOG_DIR}/pg_backup_\${DATE_STR}.stderr.log"
: > "$LOG_STDOUT"
: > "$LOG_STDERR"

format_bytes() {
  local bytes="\${1:-0}"
  if (( bytes < 1024 )); then echo "\${bytes} B"
  elif (( bytes < 1048576 )); then echo "$(( (bytes + 1023) / 1024 )) KB"
  elif (( bytes < 1073741824 )); then echo "$(( (bytes + 1048575) / 1048576 )) MB"
  else echo "$(( (bytes + 1073741823) / 1073741824 )) GB"; fi
}

send_telemetry() {
  local status="$1"
  local exit_code="$2"
  local error_msg="$3"
  local size_bytes="\${4:-0}"
  local checksum="\${5:-}"
  local s3_k="\${6:-}"
  local s3_u="\${7:-}"
  local end_seconds="$(date +%s)"
  local duration_seconds="$(( end_seconds - START_SECONDS ))"
  local end_time_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local size_human="$(format_bytes "$size_bytes")"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Telemetry: Status=$status, Size=$size_human, Duration=\${duration_seconds}s"
    return 0
  fi

  local payload=""
  if command -v jq >/dev/null 2>&1; then
    payload=$(jq -n \\
      --arg server_id "$SERVER_ID" \\
      --arg hostname "$HOSTNAME_FQDN" \\
      --arg server_ip "$SERVER_IP" \\
      --arg project_name "$PROJECT_NAME" \\
      --arg environment "$ENVIRONMENT" \\
      --arg backup_type "db" \\
      --arg status "$status" \\
      --arg start_time "$START_TIME_ISO" \\
      --arg end_time "$end_time_iso" \\
      --argjson duration_seconds "$duration_seconds" \\
      --argjson backup_size_bytes "$size_bytes" \\
      --arg backup_size_human "$size_human" \\
      --arg s3_bucket "$S3_BUCKET" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
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
        s3_bucket: $s3_bucket,
        s3_key: $s3_key,
        s3_url: $s3_url,
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🐘 [1/5] Cleaning old local archives in \${BACKUP_PATH}..."
rm -f "\${BACKUP_PATH}"/*.zip "\${BACKUP_PATH}"/*.sql 2>/dev/null || true

echo "🐘 [2/5] Running pg_dump for '\${DB_NAME}' from \${DB_HOST}:\${DB_PORT}..."
export PGPASSWORD="$DB_PASSWORD"
if ! pg_dump --username="$DB_USER" --host="$DB_HOST" --port="$DB_PORT" --no-password --file="$SQL_FILE" --format=c "$DB_NAME" >"$LOG_STDOUT" 2>"$LOG_STDERR"; then
  ERR="PostgreSQL dump failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" ""
  exit 1
fi

echo "📦 [3/5] Compressing SQL dump into archive..."
if ! zip -j -r9 "$ZIP_FILE" "$SQL_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="Zip compression failed: $(tail -n 3 "$LOG_STDERR")"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" ""
  exit 1
fi
rm -f "$SQL_FILE"

LATEST_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE" 2>/dev/null || wc -c < "$ZIP_FILE" | tr -d ' ')
CHECKSUM=$(sha256sum "$ZIP_FILE" 2>/dev/null | awk '{print $1}' || echo "")
echo "📊 Archive Size: \${LATEST_SIZE} bytes ($(format_bytes "$LATEST_SIZE"))"

STATUS="SUCCESS"
ANOMALY_MSG=""
if (( LATEST_SIZE < MIN_FILE_SIZE )); then
  STATUS="WARNING"
  ANOMALY_MSG="Warning: Backup size ($(format_bytes "$LATEST_SIZE")) is below minimum threshold ($(format_bytes "$MIN_FILE_SIZE"))."
  echo "⚠️ $ANOMALY_MSG"
fi

echo "☁️  [4/5] Uploading to AWS S3: \${S3_URL}..."
if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
  exit 1
fi

echo "🧹 [5/5] Managing S3 retention (Keep max \${MAX_FILES} files)..."
if command -v aws >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  S3_FILES_JSON=$(aws s3 ls "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/" 2>/dev/null | awk '{print "{\\"date\\":\\""$1" "$2"\\", \\"filename\\":\\""$4"\\"}"}' | jq -s '.' 2>/dev/null || echo "[]")
  FILE_COUNT=$(echo "$S3_FILES_JSON" | jq 'length' 2>/dev/null || echo "0")
  if (( FILE_COUNT > MAX_FILES )); then
    PRUNE_COUNT=$(( FILE_COUNT - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives from S3..."
    echo "$S3_FILES_JSON" | jq -r 'sort_by(.date) | .[:'"$PRUNE_COUNT"'] | .[].filename' | while read -r OLD_FILE; do
      if [ -n "$OLD_FILE" ]; then
        aws s3 rm "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/\${OLD_FILE}" || true
      fi
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
echo "🎉 PostgreSQL Backup Completed Successfully!"
`;
}

export function generateMysqlScript(cfg: GeneratorConfig): string {
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_mysql_project';
  const dbUser = cfg.dbUser || 'root';
  const dbPass = cfg.dbPassword || 'DB_PASSWORD_HERE';
  const dbHost = cfg.dbHost || '127.0.0.1';
  const dbPort = cfg.dbPort || '3306';
  const dbName = cfg.dbName || 'my_database';
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_db_backup`;
  const backupPath = cfg.backupPath || '/var/backups/mysql';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — MySQL / MariaDB S3 Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Database:      ${dbName} (${dbHost}:${dbPort})
# S3 Target:     s3://${s3Bucket}/${s3Folder}
# Retention:     ${retentionDays} days (${maxFiles} max archives)
# ==============================================================================

set -uo pipefail
umask 133

# --- Central Ingestion Hub ---
HUB_API_URL="\${BACKUP_HUB_URL:-${apiUrl}}"
HUB_API_KEY="\${BACKUP_API_KEY:-${apiKey}}"
ENVIRONMENT="\${ENVIRONMENT:-${cfg.environment || 'production'}}"

# --- MySQL Credentials & Host ---
PROJECT_NAME="\${PROJECT_NAME:-${project}}"
DB_USER="\${MYSQL_USER:-\${DB_USER:-${dbUser}}}"
DB_PASSWORD="\${MYSQL_PWD:-\${DB_PASSWORD:-${dbPass}}}"
DB_HOST="\${MYSQL_HOST:-\${DB_HOST:-${dbHost}}}"
DB_PORT="\${MYSQL_TCP_PORT:-\${DB_PORT:-${dbPort}}}"
DB_NAME="\${MYSQL_DATABASE:-\${DB_NAME:-${dbName}}}"

# --- S3 Storage & Retention Policy ---
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path ---
BACKUP_PATH="\${BACKUP_PATH:-${backupPath}}"
DRY_RUN=false

# --- Server Identity ---
SERVER_ID="\${SERVER_ID:-${serverId}}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

DATE_STR="$(date +"%d-%b-%Y_%H-%M")"
START_TIME_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_SECONDS="$(date +%s)"
SQL_FILENAME="\${DB_NAME}-\${DATE_STR}.sql"
ZIP_FILENAME="\${DB_NAME}-\${DATE_STR}.zip"
SQL_FILE="\${BACKUP_PATH}/\${SQL_FILENAME}"
ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" "$BACKUP_PATH" 2>/dev/null || true
LOG_STDOUT="\${TEMP_LOG_DIR}/mysql_backup_\${DATE_STR}.stdout.log"
LOG_STDERR="\${TEMP_LOG_DIR}/mysql_backup_\${DATE_STR}.stderr.log"
: > "$LOG_STDOUT"
: > "$LOG_STDERR"

format_bytes() {
  local bytes="\${1:-0}"
  if (( bytes < 1024 )); then echo "\${bytes} B"
  elif (( bytes < 1048576 )); then echo "$(( (bytes + 1023) / 1024 )) KB"
  elif (( bytes < 1073741824 )); then echo "$(( (bytes + 1048575) / 1048576 )) MB"
  else echo "$(( (bytes + 1073741823) / 1073741824 )) GB"; fi
}

send_telemetry() {
  local status="$1"
  local exit_code="$2"
  local error_msg="$3"
  local size_bytes="\${4:-0}"
  local checksum="\${5:-}"
  local s3_k="\${6:-}"
  local s3_u="\${7:-}"
  local end_seconds="$(date +%s)"
  local duration_seconds="$(( end_seconds - START_SECONDS ))"
  local end_time_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local size_human="$(format_bytes "$size_bytes")"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Telemetry: Status=$status, Size=$size_human, Duration=\${duration_seconds}s"
    return 0
  fi

  local payload=""
  if command -v jq >/dev/null 2>&1; then
    payload=$(jq -n \\
      --arg server_id "$SERVER_ID" \\
      --arg hostname "$HOSTNAME_FQDN" \\
      --arg server_ip "$SERVER_IP" \\
      --arg project_name "$PROJECT_NAME" \\
      --arg environment "$ENVIRONMENT" \\
      --arg backup_type "db" \\
      --arg status "$status" \\
      --arg start_time "$START_TIME_ISO" \\
      --arg end_time "$end_time_iso" \\
      --argjson duration_seconds "$duration_seconds" \\
      --argjson backup_size_bytes "$size_bytes" \\
      --arg backup_size_human "$size_human" \\
      --arg s3_bucket "$S3_BUCKET" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
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
        s3_bucket: $s3_bucket,
        s3_key: $s3_key,
        s3_url: $s3_url,
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🐬 [1/5] Cleaning old local archives in \${BACKUP_PATH}..."
rm -f "\${BACKUP_PATH}"/*.zip "\${BACKUP_PATH}"/*.sql 2>/dev/null || true

echo "🐬 [2/5] Running online non-blocking mysqldump for '\${DB_NAME}'..."
export MYSQL_PWD="$DB_PASSWORD"
if ! mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \\
  --single-transaction --quick --routines --triggers "$DB_NAME" >"$SQL_FILE" 2>"$LOG_STDERR"; then
  ERR="MySQL dump failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" ""
  exit 1
fi

echo "📦 [3/5] Compressing SQL dump into archive..."
if ! zip -j -r9 "$ZIP_FILE" "$SQL_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="Zip compression failed: $(tail -n 3 "$LOG_STDERR")"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" ""
  exit 1
fi
rm -f "$SQL_FILE"

LATEST_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE" 2>/dev/null || wc -c < "$ZIP_FILE" | tr -d ' ')
CHECKSUM=$(sha256sum "$ZIP_FILE" 2>/dev/null | awk '{print $1}' || echo "")
echo "📊 Archive Size: \${LATEST_SIZE} bytes ($(format_bytes "$LATEST_SIZE"))"

STATUS="SUCCESS"
ANOMALY_MSG=""
if (( LATEST_SIZE < MIN_FILE_SIZE )); then
  STATUS="WARNING"
  ANOMALY_MSG="Warning: Backup size ($(format_bytes "$LATEST_SIZE")) is below minimum threshold ($(format_bytes "$MIN_FILE_SIZE"))."
  echo "⚠️ $ANOMALY_MSG"
fi

echo "☁️  [4/5] Uploading to AWS S3: \${S3_URL}..."
if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
  exit 1
fi

echo "🧹 [5/5] Managing S3 retention (Keep max \${MAX_FILES} files)..."
if command -v aws >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  S3_FILES_JSON=$(aws s3 ls "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/" 2>/dev/null | awk '{print "{\\"date\\":\\""$1" "$2"\\", \\"filename\\":\\""$4"\\"}"}' | jq -s '.' 2>/dev/null || echo "[]")
  FILE_COUNT=$(echo "$S3_FILES_JSON" | jq 'length' 2>/dev/null || echo "0")
  if (( FILE_COUNT > MAX_FILES )); then
    PRUNE_COUNT=$(( FILE_COUNT - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives from S3..."
    echo "$S3_FILES_JSON" | jq -r 'sort_by(.date) | .[:'"$PRUNE_COUNT"'] | .[].filename' | while read -r OLD_FILE; do
      if [ -n "$OLD_FILE" ]; then
        aws s3 rm "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/\${OLD_FILE}" || true
      fi
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
echo "🎉 MySQL Backup Completed Successfully!"
`;
}

export function generateZipScript(cfg: GeneratorConfig): string {
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_web_app';
  const sourcePath = cfg.sourcePath || '/var/www/html';
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_files_backup`;
  const backupPath = cfg.backupPath || '/var/backups/zip';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';
  const excludes = cfg.excludePatterns || 'node_modules/* .git/* *.log cache/* tmp/*';

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Directory & File Zip S3 Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Source Path:   ${sourcePath}
# S3 Target:     s3://${s3Bucket}/${s3Folder}
# Retention:     ${retentionDays} days (${maxFiles} max archives)
# ==============================================================================

set -uo pipefail
umask 133

# --- Central Ingestion Hub ---
HUB_API_URL="\${BACKUP_HUB_URL:-${apiUrl}}"
HUB_API_KEY="\${BACKUP_API_KEY:-${apiKey}}"
ENVIRONMENT="\${ENVIRONMENT:-${cfg.environment || 'production'}}"

# --- Target Configuration ---
PROJECT_NAME="\${PROJECT_NAME:-${project}}"
SOURCE_PATH="\${SOURCE_PATH:-${sourcePath}}"
EXCLUDE_PATTERNS=(${excludes})

# --- S3 Storage & Retention Policy ---
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path ---
BACKUP_PATH="\${BACKUP_PATH:-${backupPath}}"
DRY_RUN=false

# --- Server Identity ---
SERVER_ID="\${SERVER_ID:-${serverId}}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

DATE_STR="$(date +"%d-%b-%Y_%H-%M")"
START_TIME_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_SECONDS="$(date +%s)"
ZIP_FILENAME="\${PROJECT_NAME}-\${DATE_STR}.zip"
ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" "$BACKUP_PATH" 2>/dev/null || true
LOG_STDOUT="\${TEMP_LOG_DIR}/zip_backup_\${DATE_STR}.stdout.log"
LOG_STDERR="\${TEMP_LOG_DIR}/zip_backup_\${DATE_STR}.stderr.log"
: > "$LOG_STDOUT"
: > "$LOG_STDERR"

format_bytes() {
  local bytes="\${1:-0}"
  if (( bytes < 1024 )); then echo "\${bytes} B"
  elif (( bytes < 1048576 )); then echo "$(( (bytes + 1023) / 1024 )) KB"
  elif (( bytes < 1073741824 )); then echo "$(( (bytes + 1048575) / 1048576 )) MB"
  else echo "$(( (bytes + 1073741823) / 1073741824 )) GB"; fi
}

send_telemetry() {
  local status="$1"
  local exit_code="$2"
  local error_msg="$3"
  local size_bytes="\${4:-0}"
  local checksum="\${5:-}"
  local s3_k="\${6:-}"
  local s3_u="\${7:-}"
  local end_seconds="$(date +%s)"
  local duration_seconds="$(( end_seconds - START_SECONDS ))"
  local end_time_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local size_human="$(format_bytes "$size_bytes")"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Telemetry: Status=$status, Size=$size_human, Duration=\${duration_seconds}s"
    return 0
  fi

  local payload=""
  if command -v jq >/dev/null 2>&1; then
    payload=$(jq -n \\
      --arg server_id "$SERVER_ID" \\
      --arg hostname "$HOSTNAME_FQDN" \\
      --arg server_ip "$SERVER_IP" \\
      --arg project_name "$PROJECT_NAME" \\
      --arg environment "$ENVIRONMENT" \\
      --arg backup_type "code" \\
      --arg status "$status" \\
      --arg start_time "$START_TIME_ISO" \\
      --arg end_time "$end_time_iso" \\
      --argjson duration_seconds "$duration_seconds" \\
      --argjson backup_size_bytes "$size_bytes" \\
      --arg backup_size_human "$size_human" \\
      --arg s3_bucket "$S3_BUCKET" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
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
        s3_bucket: $s3_bucket,
        s3_key: $s3_key,
        s3_url: $s3_url,
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🗜️  [1/4] Cleaning old local archives in \${BACKUP_PATH}..."
rm -f "\${BACKUP_PATH}"/*.zip 2>/dev/null || true

echo "🗜️  [2/4] Compressing source directory '\${SOURCE_PATH}'..."
EXCLUDE_ARGS=()
for pat in "\${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS+=("-x" "*$pat*")
done

SOURCE_DIR=$(dirname "$SOURCE_PATH")
BASE_NAME=$(basename "$SOURCE_PATH")

if ! (cd "$SOURCE_DIR" && zip -r9 "$ZIP_FILE" "$BASE_NAME" "\${EXCLUDE_ARGS[@]}") >"$LOG_STDOUT" 2>"$LOG_STDERR"; then
  ERR="Zip archiving failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" ""
  exit 1
fi

LATEST_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE" 2>/dev/null || wc -c < "$ZIP_FILE" | tr -d ' ')
CHECKSUM=$(sha256sum "$ZIP_FILE" 2>/dev/null | awk '{print $1}' || echo "")
echo "📊 Archive Size: \${LATEST_SIZE} bytes ($(format_bytes "$LATEST_SIZE"))"

STATUS="SUCCESS"
ANOMALY_MSG=""
if (( LATEST_SIZE < MIN_FILE_SIZE )); then
  STATUS="WARNING"
  ANOMALY_MSG="Warning: Backup size ($(format_bytes "$LATEST_SIZE")) is below minimum threshold ($(format_bytes "$MIN_FILE_SIZE"))."
  echo "⚠️ $ANOMALY_MSG"
fi

echo "☁️  [3/4] Uploading to AWS S3: \${S3_URL}..."
if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
  exit 1
fi

echo "🧹 [4/4] Managing S3 retention (Keep max \${MAX_FILES} files)..."
if command -v aws >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  S3_FILES_JSON=$(aws s3 ls "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/" 2>/dev/null | awk '{print "{\\"date\\":\\""$1" "$2"\\", \\"filename\\":\\""$4"\\"}"}' | jq -s '.' 2>/dev/null || echo "[]")
  FILE_COUNT=$(echo "$S3_FILES_JSON" | jq 'length' 2>/dev/null || echo "0")
  if (( FILE_COUNT > MAX_FILES )); then
    PRUNE_COUNT=$(( FILE_COUNT - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives from S3..."
    echo "$S3_FILES_JSON" | jq -r 'sort_by(.date) | .[:'"$PRUNE_COUNT"'] | .[].filename' | while read -r OLD_FILE; do
      if [ -n "$OLD_FILE" ]; then
        aws s3 rm "s3://\${S3_BUCKET}/\${S3_FOLDER_NAME}/\${OLD_FILE}" || true
      fi
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$S3_KEY" "$S3_URL"
echo "🎉 Directory Zip Backup Completed Successfully!"
`;
}

export function generateCurlSnippet(cfg: GeneratorConfig): string {
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_custom_project';
  const retention = cfg.retentionDays || 30;

  return `# ==============================================================================
# Paste this block at the end of your existing backup bash script:
# ==============================================================================

BACKUP_PULSE_STATUS="SUCCESS"  # Set to "FAILED" if your previous dump command failed
ARCHIVE_PATH="/path/to/your/backup_file.tar.gz"  # Change to your actual archive path
ARCHIVE_SIZE=$(stat -c%s "$ARCHIVE_PATH" 2>/dev/null || echo 0)
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X POST "${apiUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d "{
    \\"server_id\\": \\"$(hostname -s 2>/dev/null || echo 'server-unknown')\\",
    \\"hostname\\": \\"$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')\\",
    \\"server_ip\\": \\"$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')\\",
    \\"project_name\\": \\"${project}\\",
    \\"environment\\": \\"${cfg.environment || 'production'}\\",
    \\"backup_type\\": \\"db\\",
    \\"status\\": \\"$BACKUP_PULSE_STATUS\\",
    \\"start_time\\": \\"$START_TIME\\",
    \\"end_time\\": \\"$END_TIME\\",
    \\"duration_seconds\\": 12,
    \\"backup_size_bytes\\": $ARCHIVE_SIZE,
    \\"retention_days\\": ${retention},
    \\"zip_filename\\": \\"$(basename "$ARCHIVE_PATH")\\"
  }"
`;
}

export function generateCrontabLine(scriptPath: string, schedule: string = '59 23 * * *'): string {
  return `# Run BackupPulse backup cron job
${schedule} bash ${scriptPath} >> /var/log/backuppulse_cron.log 2>&1`;
}

export function generateInstallCommands(backupType: 'postgres' | 'mysql' | 'zip' | 'curl', stagingPath: string = '/var/backups'): {
  debian: string;
  rhel: string;
  prep: string;
} {
  let debPkgs = 'zip unzip jq awscli curl';
  let rhelPkgs = 'zip unzip jq awscli curl';

  if (backupType === 'postgres') {
    debPkgs = `postgresql-client ${debPkgs}`;
    rhelPkgs = `postgresql ${rhelPkgs}`;
  } else if (backupType === 'mysql') {
    debPkgs = `default-mysql-client ${debPkgs}`;
    rhelPkgs = `mysql ${rhelPkgs}`;
  }

  return {
    debian: `sudo apt update && sudo apt install -y ${debPkgs}`,
    rhel: `sudo yum install -y ${rhelPkgs}`,
    prep: `sudo mkdir -p ${stagingPath} /opt/scripts
sudo chmod 777 ${stagingPath}
sudo chmod +x /opt/scripts/*.sh`,
  };
}
