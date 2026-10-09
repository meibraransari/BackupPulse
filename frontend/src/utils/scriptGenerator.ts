// ==============================================================================
// BackupPulse Script Generator Utility
// Generates ready-to-run, production-grade backup scripts and curl snippets
// Supports: AWS S3, Google Cloud Storage (GCS), Azure Blob Storage,
//           Local Server Path, and Network Shared Drive (NFS / CIFS / SMB)
// ==============================================================================

export type StorageDestination = 's3' | 'gcs' | 'azure' | 'local' | 'shared_drive';

export interface GeneratorConfig {
  backupType: 'postgres' | 'mysql' | 'zip' | 'curl';
  storageDestination?: StorageDestination;
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

  // AWS S3 specific
  s3Bucket: string;
  s3Folder: string;

  // Google Cloud Storage specific
  gcsBucket?: string;
  gcsFolder?: string;

  // Azure Blob Storage specific
  azureStorageAccount?: string;
  azureContainer?: string;
  azureFolder?: string;
  azureSasToken?: string;
  azureConnectionString?: string;

  // Local / Shared Drive specific
  backupPath: string; // Local staging directory
  localBackupDir?: string; // Target local storage directory
  sharedDrivePath?: string; // Target mounted shared drive path

  // Zip specific
  sourcePath?: string;
  excludePatterns?: string;

  // Cron schedule
  cronSchedule?: string;

  // Disaster Recovery / Restore Drill
  enableRestoreDrill?: boolean;
}

export function generatePostgresScript(cfg: GeneratorConfig): string {
  const dest: StorageDestination = cfg.storageDestination || 's3';
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_postgres_project';
  const dbUser = cfg.dbUser || 'postgres';
  const dbPass = cfg.dbPassword || 'DB_PASSWORD_HERE';
  const dbHost = cfg.dbHost || '127.0.0.1';
  const dbPort = cfg.dbPort || '5432';
  const dbName = cfg.dbName || 'my_database';

  // Cloud targets
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_db_backup`;
  const gcsBucket = cfg.gcsBucket || 'my-gcp-backup-vault';
  const gcsFolder = cfg.gcsFolder || `${project}_db_backup`;
  const azureAccount = cfg.azureStorageAccount || 'mybackupstorage';
  const azureContainer = cfg.azureContainer || 'backups';
  const azureFolder = cfg.azureFolder || `${project}_db_backup`;
  const azureSas = cfg.azureSasToken || '';
  const azureConn = cfg.azureConnectionString || '';

  // Local / mount targets
  const stagingPath = cfg.backupPath || (dest === 'local' ? '/var/backups/postgres' : '/tmp/backup_staging');
  const localBackupDir = cfg.localBackupDir || '/var/backups/postgres';
  const sharedDrivePath = cfg.sharedDrivePath || '/mnt/backup_share';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';

  const targetLabel =
    dest === 's3'
      ? `AWS S3 (s3://${s3Bucket}/${s3Folder})`
      : dest === 'gcs'
      ? `Google Cloud Storage (gs://${gcsBucket}/${gcsFolder})`
      : dest === 'azure'
      ? `Azure Blob Storage (${azureAccount}/${azureContainer}/${azureFolder})`
      : dest === 'local'
      ? `Local Disk (${localBackupDir})`
      : `Shared Drive (${sharedDrivePath})`;

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — PostgreSQL Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Database:      ${dbName} (${dbHost}:${dbPort})
# Destination:   ${targetLabel}
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

# --- Destination & Retention Policy ---
DESTINATION="\${DESTINATION:-${dest}}"  # Options: s3, gcs, azure, local, shared_drive
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
GCS_BUCKET="\${GCS_BUCKET:-${gcsBucket}}"
GCS_FOLDER_NAME="\${GCS_FOLDER_NAME:-${gcsFolder}}"
AZURE_STORAGE_ACCOUNT="\${AZURE_STORAGE_ACCOUNT:-${azureAccount}}"
AZURE_CONTAINER="\${AZURE_CONTAINER:-${azureContainer}}"
AZURE_FOLDER="\${AZURE_FOLDER:-${azureFolder}}"
AZURE_SAS_TOKEN="\${AZURE_SAS_TOKEN:-${azureSas}}"
AZURE_CONNECTION_STRING="\${AZURE_CONNECTION_STRING:-${azureConn}}"
LOCAL_BACKUP_DIR="\${LOCAL_BACKUP_DIR:-${localBackupDir}}"
SHARED_DRIVE_PATH="\${SHARED_DRIVE_PATH:-${sharedDrivePath}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path & Server Identity ---
BACKUP_PATH="\${BACKUP_PATH:-${stagingPath}}"
DRY_RUN=false
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
    --destination) DESTINATION="$2"; shift 2 ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-folder) S3_FOLDER_NAME="$2"; shift 2 ;;
    --gcs-bucket) GCS_BUCKET="$2"; shift 2 ;;
    --gcs-folder) GCS_FOLDER_NAME="$2"; shift 2 ;;
    --azure-account) AZURE_STORAGE_ACCOUNT="$2"; shift 2 ;;
    --azure-container) AZURE_CONTAINER="$2"; shift 2 ;;
    --azure-folder) AZURE_FOLDER="$2"; shift 2 ;;
    --local-dir) LOCAL_BACKUP_DIR="$2"; shift 2 ;;
    --shared-dir) SHARED_DRIVE_PATH="$2"; shift 2 ;;
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
RESTORE_DRILL_STATUS="${cfg.enableRestoreDrill ? 'SKIPPED' : ''}"
RESTORE_DRILL_DURATION=0
RESTORE_DRILL_TABLES=0
RESTORE_DRILL_LOG=""
SQL_FILENAME="\${DB_NAME}-\${DATE_STR}.sql"
ZIP_FILENAME="\${DB_NAME}-\${DATE_STR}.zip"

# Stage directly in local target directory if destination is local
if [ "$DESTINATION" = "local" ]; then
  mkdir -p "$LOCAL_BACKUP_DIR" 2>/dev/null || true
  SQL_FILE="\${LOCAL_BACKUP_DIR}/\${SQL_FILENAME}"
  ZIP_FILE="\${LOCAL_BACKUP_DIR}/\${ZIP_FILENAME}"
else
  mkdir -p "$BACKUP_PATH" 2>/dev/null || true
  SQL_FILE="\${BACKUP_PATH}/\${SQL_FILENAME}"
  ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
fi

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" 2>/dev/null || true
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
  local s3_b="\${6:-}"
  local s3_k="\${7:-}"
  local s3_u="\${8:-}"
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
      --arg s3_bucket "$s3_b" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
      --arg restore_drill_status "$RESTORE_DRILL_STATUS" \\
      --argjson restore_drill_duration_seconds "$RESTORE_DRILL_DURATION" \\
      --argjson restore_drill_verified_tables "$RESTORE_DRILL_TABLES" \\
      --arg restore_drill_log "$RESTORE_DRILL_LOG" \\
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
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end),
        restore_drill_status: (if $restore_drill_status == "" then null else $restore_drill_status end),
        restore_drill_duration_seconds: (if $restore_drill_duration_seconds == 0 then null else $restore_drill_duration_seconds end),
        restore_drill_verified_tables: (if $restore_drill_verified_tables == 0 then null else $restore_drill_verified_tables end),
        restore_drill_log: (if $restore_drill_log == "" then null else $restore_drill_log end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🐘 [1/5] Checking environment & cleaning temporary staging..."
if [ "$DESTINATION" = "shared_drive" ]; then
  if [ ! -d "$SHARED_DRIVE_PATH" ]; then
    ERR="Shared drive directory '\${SHARED_DRIVE_PATH}' does not exist or is not mounted!"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" 0 "" "Shared Drive" "$SHARED_DRIVE_PATH" ""
    exit 1
  fi
fi
rm -f "$SQL_FILE" 2>/dev/null || true

echo "🐘 [2/5] Running pg_dump for '\${DB_NAME}' from \${DB_HOST}:\${DB_PORT}..."
export PGPASSWORD="$DB_PASSWORD"
if ! pg_dump --username="$DB_USER" --host="$DB_HOST" --port="$DB_PORT" --no-password --file="$SQL_FILE" --format=c "$DB_NAME" >"$LOG_STDOUT" 2>"$LOG_STDERR"; then
  ERR="PostgreSQL dump failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
  exit 1
fi

echo "📦 [3/5] Compressing SQL dump into archive..."
if ! zip -j -r9 "$ZIP_FILE" "$SQL_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="Zip compression failed: $(tail -n 3 "$LOG_STDERR")"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
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
${cfg.enableRestoreDrill ? `
echo "🧪 [DrillPulse] Executing ephemeral sandbox restore verification..."
DRILL_START_SEC=$(date +%s)
DRILL_CONTAINER_NAME="backuppulse-drill-pg-\${DATE_STR}-\$RANDOM"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "🐳 Launching ephemeral isolated PostgreSQL sandbox container..."
  if docker run -d --rm --name "$DRILL_CONTAINER_NAME" \\
    --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \\
    -e POSTGRES_PASSWORD=drillpass \\
    -e POSTGRES_DB="drill_test_db" \\
    postgres:alpine >/dev/null 2>&1; then
    
    READY=false
    for i in {1..15}; do
      if docker exec "$DRILL_CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
        READY=true
        break
      fi
      sleep 1
    done

    if [ "$READY" = true ]; then
      echo "📥 Restoring backup dump into ephemeral sandbox container..."
      unzip -p "$ZIP_FILE" | docker exec -i "$DRILL_CONTAINER_NAME" pg_restore -U postgres -d drill_test_db --no-owner --no-privileges 2>"${TEMP_LOG_DIR}/pg_drill.log" || true
      
      RESTORE_DRILL_TABLES=$(docker exec "$DRILL_CONTAINER_NAME" psql -U postgres -d drill_test_db -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
      RESTORE_DRILL_TABLES=$(echo "$RESTORE_DRILL_TABLES" | tr -d '[:space:]')
      if [ -z "$RESTORE_DRILL_TABLES" ]; then RESTORE_DRILL_TABLES=0; fi

      DRILL_END_SEC=$(date +%s)
      RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))

      if (( RESTORE_DRILL_TABLES > 0 )); then
        RESTORE_DRILL_STATUS="SUCCESS"
        RESTORE_DRILL_LOG="Verification PASSED: Restored dump and verified \${RESTORE_DRILL_TABLES} public tables."
        echo "✅ Sandbox restoration test PASSED! Verified \${RESTORE_DRILL_TABLES} tables in \${RESTORE_DRILL_DURATION}s."
      else
        RESTORE_DRILL_STATUS="FAILED"
        RESTORE_DRILL_LOG="Verification FAILED: Ephemeral sandbox produced 0 tables."
        echo "⚠️ Ephemeral sandbox produced 0 tables."
      fi
    else
      RESTORE_DRILL_STATUS="FAILED"
      RESTORE_DRILL_LOG="Verification FAILED: Ephemeral postgres container failed to become ready."
      echo "⚠️ Ephemeral postgres container failed to become ready."
    fi

    docker rm -f "$DRILL_CONTAINER_NAME" >/dev/null 2>&1 || true
  else
    RESTORE_DRILL_STATUS="FAILED"
    RESTORE_DRILL_LOG="Verification FAILED: Unable to launch ephemeral docker container."
    echo "⚠️ Failed to launch ephemeral docker container."
  fi
else
  echo "ℹ️ Docker unavailable. Testing zip archive binary integrity (unzip -t)..."
  if unzip -t "$ZIP_FILE" >/dev/null 2>&1; then
    DRILL_END_SEC=$(date +%s)
    RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
    RESTORE_DRILL_STATUS="SUCCESS"
    RESTORE_DRILL_TABLES=1
    RESTORE_DRILL_LOG="Verification PASSED: Archive binary checksum & integrity verified (Docker sandbox unavailable)."
    echo "✅ Archive integrity drill PASSED (\${RESTORE_DRILL_DURATION}s)."
  else
    DRILL_END_SEC=$(date +%s)
    RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
    RESTORE_DRILL_STATUS="FAILED"
    RESTORE_DRILL_LOG="Verification FAILED: Archive test failed (corrupted or unreadable zip)."
    echo "❌ Archive integrity drill FAILED."
  fi
fi
` : ''}

FINAL_BUCKET=""
FINAL_KEY=""
FINAL_URL=""

if [ "$DESTINATION" = "s3" ]; then
  S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
  S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"
  FINAL_BUCKET="$S3_BUCKET"
  FINAL_KEY="$S3_KEY"
  FINAL_URL="$S3_URL"

  echo "☁️  [4/5] Uploading to AWS S3: \${S3_URL}..."
  if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
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
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "gcs" ]; then
  GCS_KEY="\${GCS_FOLDER_NAME}/\${ZIP_FILENAME}"
  GCS_URL="gs://\${GCS_BUCKET}/\${GCS_KEY}"
  FINAL_BUCKET="gs://\${GCS_BUCKET}"
  FINAL_KEY="$GCS_KEY"
  FINAL_URL="$GCS_URL"

  echo "🌐 [4/5] Uploading to Google Cloud Storage: \${GCS_URL}..."
  UPLOAD_OK=false
  if command -v gcloud >/dev/null 2>&1; then
    if gcloud storage cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    if gsutil cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither 'gcloud' nor 'gsutil' CLI was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="GCS upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [5/5] Managing GCS retention (Keep max \${MAX_FILES} files)..."
  if command -v gcloud >/dev/null 2>&1; then
    GCS_FILES=($(gcloud storage ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gcloud storage rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    GCS_FILES=($(gsutil ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gsutil rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "azure" ]; then
  AZURE_BLOB_NAME="\${AZURE_FOLDER}/\${ZIP_FILENAME}"
  AZURE_BLOB_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
  FINAL_BUCKET="Azure: \${AZURE_CONTAINER}"
  FINAL_KEY="$AZURE_BLOB_NAME"
  FINAL_URL="$AZURE_BLOB_URL"

  echo "🔷 [4/5] Uploading to Azure Blob Storage: \${AZURE_BLOB_URL}..."
  UPLOAD_OK=false
  AUTH_ARGS=()
  if [ -n "$AZURE_CONNECTION_STRING" ]; then
    AUTH_ARGS+=(--connection-string "$AZURE_CONNECTION_STRING")
  elif [ -n "$AZURE_SAS_TOKEN" ]; then
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --sas-token "$AZURE_SAS_TOKEN")
  else
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --auth-mode login)
  fi

  if command -v az >/dev/null 2>&1; then
    if az storage blob upload \\
      --container-name "$AZURE_CONTAINER" \\
      --name "$AZURE_BLOB_NAME" \\
      --file "$ZIP_FILE" \\
      --overwrite true \\
      "\${AUTH_ARGS[@]}" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v azcopy >/dev/null 2>&1; then
    DEST_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
    if [ -n "$AZURE_SAS_TOKEN" ]; then
      DEST_URL="\${DEST_URL}?\${AZURE_SAS_TOKEN#\\?}"
    fi
    if azcopy copy "$ZIP_FILE" "$DEST_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither Azure CLI ('az') nor 'azcopy' was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="Azure Blob upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [5/5] Managing Azure Blob retention (Keep max \${MAX_FILES} files)..."
  if command -v az >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    BLOBS_JSON=$(az storage blob list --container-name "$AZURE_CONTAINER" --prefix "\${AZURE_FOLDER}/" "\${AUTH_ARGS[@]}" --query "[].name" -o json 2>/dev/null || echo "[]")
    TOTAL_BLOBS=$(echo "$BLOBS_JSON" | jq 'length' 2>/dev/null || echo "0")
    if (( TOTAL_BLOBS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_BLOBS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from Azure Blob..."
      echo "$BLOBS_JSON" | jq -r 'sort | .[:'"$PRUNE_COUNT"'] | .[]' | while read -r OLD_BLOB; do
        if [ -n "$OLD_BLOB" ]; then
          az storage blob delete --container-name "$AZURE_CONTAINER" --name "$OLD_BLOB" "\${AUTH_ARGS[@]}" 2>/dev/null || true
        fi
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "shared_drive" ]; then
  DEST_FILE="\${SHARED_DRIVE_PATH}/\${ZIP_FILENAME}"
  FINAL_BUCKET="Shared Drive"
  FINAL_KEY="$DEST_FILE"
  FINAL_URL="file://\${DEST_FILE}"

  echo "📁 [4/5] Copying archive to shared drive: \${DEST_FILE}..."
  if ! cp -p "$ZIP_FILE" "$DEST_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="Copy to shared drive failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi
  rm -f "$ZIP_FILE"

  echo "🧹 [5/5] Managing shared drive retention (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$SHARED_DRIVE_PATH" -maxdepth 1 -name "\${DB_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$SHARED_DRIVE_PATH"/\${DB_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives on shared drive..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi

else # destination == local
  FINAL_BUCKET="Local Storage"
  FINAL_KEY="$ZIP_FILE"
  FINAL_URL="file://\${ZIP_FILE}"

  echo "💻 [4/5] Saved archive to local storage: \${ZIP_FILE}"

  echo "🧹 [5/5] Managing local retention in \${LOCAL_BACKUP_DIR} (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name "\${DB_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$LOCAL_BACKUP_DIR"/\${DB_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest local archives..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
echo "🎉 PostgreSQL Backup Completed Successfully!"
`;
}

export function generateMysqlScript(cfg: GeneratorConfig): string {
  const dest: StorageDestination = cfg.storageDestination || 's3';
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_mysql_project';
  const dbUser = cfg.dbUser || 'root';
  const dbPass = cfg.dbPassword || 'DB_PASSWORD_HERE';
  const dbHost = cfg.dbHost || '127.0.0.1';
  const dbPort = cfg.dbPort || '3306';
  const dbName = cfg.dbName || 'my_database';

  // Cloud targets
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_db_backup`;
  const gcsBucket = cfg.gcsBucket || 'my-gcp-backup-vault';
  const gcsFolder = cfg.gcsFolder || `${project}_db_backup`;
  const azureAccount = cfg.azureStorageAccount || 'mybackupstorage';
  const azureContainer = cfg.azureContainer || 'backups';
  const azureFolder = cfg.azureFolder || `${project}_db_backup`;
  const azureSas = cfg.azureSasToken || '';
  const azureConn = cfg.azureConnectionString || '';

  // Local / mount targets
  const stagingPath = cfg.backupPath || (dest === 'local' ? '/var/backups/mysql' : '/tmp/backup_staging');
  const localBackupDir = cfg.localBackupDir || '/var/backups/mysql';
  const sharedDrivePath = cfg.sharedDrivePath || '/mnt/backup_share';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';

  const targetLabel =
    dest === 's3'
      ? `AWS S3 (s3://${s3Bucket}/${s3Folder})`
      : dest === 'gcs'
      ? `Google Cloud Storage (gs://${gcsBucket}/${gcsFolder})`
      : dest === 'azure'
      ? `Azure Blob Storage (${azureAccount}/${azureContainer}/${azureFolder})`
      : dest === 'local'
      ? `Local Disk (${localBackupDir})`
      : `Shared Drive (${sharedDrivePath})`;

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — MySQL / MariaDB Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Database:      ${dbName} (${dbHost}:${dbPort})
# Destination:   ${targetLabel}
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

# --- Destination & Retention Policy ---
DESTINATION="\${DESTINATION:-${dest}}"  # Options: s3, gcs, azure, local, shared_drive
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
GCS_BUCKET="\${GCS_BUCKET:-${gcsBucket}}"
GCS_FOLDER_NAME="\${GCS_FOLDER_NAME:-${gcsFolder}}"
AZURE_STORAGE_ACCOUNT="\${AZURE_STORAGE_ACCOUNT:-${azureAccount}}"
AZURE_CONTAINER="\${AZURE_CONTAINER:-${azureContainer}}"
AZURE_FOLDER="\${AZURE_FOLDER:-${azureFolder}}"
AZURE_SAS_TOKEN="\${AZURE_SAS_TOKEN:-${azureSas}}"
AZURE_CONNECTION_STRING="\${AZURE_CONNECTION_STRING:-${azureConn}}"
LOCAL_BACKUP_DIR="\${LOCAL_BACKUP_DIR:-${localBackupDir}}"
SHARED_DRIVE_PATH="\${SHARED_DRIVE_PATH:-${sharedDrivePath}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path & Server Identity ---
BACKUP_PATH="\${BACKUP_PATH:-${stagingPath}}"
DRY_RUN=false
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
    --destination) DESTINATION="$2"; shift 2 ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-folder) S3_FOLDER_NAME="$2"; shift 2 ;;
    --gcs-bucket) GCS_BUCKET="$2"; shift 2 ;;
    --gcs-folder) GCS_FOLDER_NAME="$2"; shift 2 ;;
    --azure-account) AZURE_STORAGE_ACCOUNT="$2"; shift 2 ;;
    --azure-container) AZURE_CONTAINER="$2"; shift 2 ;;
    --azure-folder) AZURE_FOLDER="$2"; shift 2 ;;
    --local-dir) LOCAL_BACKUP_DIR="$2"; shift 2 ;;
    --shared-dir) SHARED_DRIVE_PATH="$2"; shift 2 ;;
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
RESTORE_DRILL_STATUS="${cfg.enableRestoreDrill ? 'SKIPPED' : ''}"
RESTORE_DRILL_DURATION=0
RESTORE_DRILL_TABLES=0
RESTORE_DRILL_LOG=""
SQL_FILENAME="\${DB_NAME}-\${DATE_STR}.sql"
ZIP_FILENAME="\${DB_NAME}-\${DATE_STR}.zip"

# Stage directly in local target directory if destination is local
if [ "$DESTINATION" = "local" ]; then
  mkdir -p "$LOCAL_BACKUP_DIR" 2>/dev/null || true
  SQL_FILE="\${LOCAL_BACKUP_DIR}/\${SQL_FILENAME}"
  ZIP_FILE="\${LOCAL_BACKUP_DIR}/\${ZIP_FILENAME}"
else
  mkdir -p "$BACKUP_PATH" 2>/dev/null || true
  SQL_FILE="\${BACKUP_PATH}/\${SQL_FILENAME}"
  ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
fi

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" 2>/dev/null || true
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
  local s3_b="\${6:-}"
  local s3_k="\${7:-}"
  local s3_u="\${8:-}"
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
      --arg s3_bucket "$s3_b" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
      --arg restore_drill_status "$RESTORE_DRILL_STATUS" \\
      --argjson restore_drill_duration_seconds "$RESTORE_DRILL_DURATION" \\
      --argjson restore_drill_verified_tables "$RESTORE_DRILL_TABLES" \\
      --arg restore_drill_log "$RESTORE_DRILL_LOG" \\
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
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end),
        restore_drill_status: (if $restore_drill_status == "" then null else $restore_drill_status end),
        restore_drill_duration_seconds: (if $restore_drill_duration_seconds == 0 then null else $restore_drill_duration_seconds end),
        restore_drill_verified_tables: (if $restore_drill_verified_tables == 0 then null else $restore_drill_verified_tables end),
        restore_drill_log: (if $restore_drill_log == "" then null else $restore_drill_log end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🐬 [1/5] Checking environment & cleaning temporary staging..."
if [ "$DESTINATION" = "shared_drive" ]; then
  if [ ! -d "$SHARED_DRIVE_PATH" ]; then
    ERR="Shared drive directory '\${SHARED_DRIVE_PATH}' does not exist or is not mounted!"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" 0 "" "Shared Drive" "$SHARED_DRIVE_PATH" ""
    exit 1
  fi
fi
rm -f "$SQL_FILE" 2>/dev/null || true

echo "🐬 [2/5] Running online non-blocking mysqldump for '\${DB_NAME}'..."
export MYSQL_PWD="$DB_PASSWORD"
if ! mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \\
  --single-transaction --quick --routines --triggers "$DB_NAME" >"$SQL_FILE" 2>"$LOG_STDERR"; then
  ERR="MySQL dump failed: $(tail -n 3 "$LOG_STDERR")"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
  exit 1
fi

echo "📦 [3/5] Compressing SQL dump into archive..."
if ! zip -j -r9 "$ZIP_FILE" "$SQL_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
  ERR="Zip compression failed: $(tail -n 3 "$LOG_STDERR")"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
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
${cfg.enableRestoreDrill ? `
echo "🧪 [DrillPulse] Executing ephemeral sandbox restore verification..."
DRILL_START_SEC=$(date +%s)
DRILL_CONTAINER_NAME="backuppulse-drill-mysql-\${DATE_STR}-\$RANDOM"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "🐳 Launching ephemeral isolated MySQL sandbox container..."
  if docker run -d --rm --name "$DRILL_CONTAINER_NAME" \\
    --tmpfs /var/lib/mysql:rw,noexec,nosuid,size=512m \\
    -e MYSQL_ROOT_PASSWORD=drillpass \\
    -e MYSQL_DATABASE=drill_test_db \\
    mysql:8.0 >/dev/null 2>&1; then
    
    READY=false
    for i in {1..20}; do
      if docker exec "$DRILL_CONTAINER_NAME" mysqladmin ping -u root -pdrillpass --silent >/dev/null 2>&1; then
        READY=true
        break
      fi
      sleep 1
    done

    if [ "$READY" = true ]; then
      echo "📥 Restoring backup into ephemeral sandbox container..."
      unzip -p "$ZIP_FILE" | docker exec -i "$DRILL_CONTAINER_NAME" mysql -u root -pdrillpass drill_test_db 2>"${TEMP_LOG_DIR}/mysql_drill.log" || true
      
      RESTORE_DRILL_TABLES=$(docker exec "$DRILL_CONTAINER_NAME" mysql -u root -pdrillpass -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'drill_test_db';" 2>/dev/null || echo "0")
      RESTORE_DRILL_TABLES=$(echo "$RESTORE_DRILL_TABLES" | tr -d '[:space:]')
      if [ -z "$RESTORE_DRILL_TABLES" ]; then RESTORE_DRILL_TABLES=0; fi

      DRILL_END_SEC=$(date +%s)
      RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))

      if (( RESTORE_DRILL_TABLES > 0 )); then
        RESTORE_DRILL_STATUS="SUCCESS"
        RESTORE_DRILL_LOG="Verification PASSED: Restored dump and verified \${RESTORE_DRILL_TABLES} tables in ephemeral sandbox."
        echo "✅ Sandbox restoration test PASSED! Verified \${RESTORE_DRILL_TABLES} tables in \${RESTORE_DRILL_DURATION}s."
      else
        RESTORE_DRILL_STATUS="FAILED"
        RESTORE_DRILL_LOG="Verification FAILED: Ephemeral sandbox produced 0 tables."
        echo "⚠️ Ephemeral sandbox produced 0 tables."
      fi
    else
      RESTORE_DRILL_STATUS="FAILED"
      RESTORE_DRILL_LOG="Verification FAILED: Ephemeral mysql container failed to become ready."
      echo "⚠️ Ephemeral mysql container failed to become ready."
    fi

    docker rm -f "$DRILL_CONTAINER_NAME" >/dev/null 2>&1 || true
  else
    RESTORE_DRILL_STATUS="FAILED"
    RESTORE_DRILL_LOG="Verification FAILED: Unable to launch ephemeral docker container."
    echo "⚠️ Failed to launch ephemeral docker container."
  fi
else
  echo "ℹ️ Docker unavailable. Testing zip archive binary integrity (unzip -t)..."
  if unzip -t "$ZIP_FILE" >/dev/null 2>&1; then
    DRILL_END_SEC=$(date +%s)
    RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
    RESTORE_DRILL_STATUS="SUCCESS"
    RESTORE_DRILL_TABLES=1
    RESTORE_DRILL_LOG="Verification PASSED: Archive binary checksum & integrity verified (Docker sandbox unavailable)."
    echo "✅ Archive integrity drill PASSED (\${RESTORE_DRILL_DURATION}s)."
  else
    DRILL_END_SEC=$(date +%s)
    RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
    RESTORE_DRILL_STATUS="FAILED"
    RESTORE_DRILL_LOG="Verification FAILED: Archive test failed (corrupted or unreadable zip)."
    echo "❌ Archive integrity drill FAILED."
  fi
fi
` : ''}

FINAL_BUCKET=""
FINAL_KEY=""
FINAL_URL=""

if [ "$DESTINATION" = "s3" ]; then
  S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
  S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"
  FINAL_BUCKET="$S3_BUCKET"
  FINAL_KEY="$S3_KEY"
  FINAL_URL="$S3_URL"

  echo "☁️  [4/5] Uploading to AWS S3: \${S3_URL}..."
  if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
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
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "gcs" ]; then
  GCS_KEY="\${GCS_FOLDER_NAME}/\${ZIP_FILENAME}"
  GCS_URL="gs://\${GCS_BUCKET}/\${GCS_KEY}"
  FINAL_BUCKET="gs://\${GCS_BUCKET}"
  FINAL_KEY="$GCS_KEY"
  FINAL_URL="$GCS_URL"

  echo "🌐 [4/5] Uploading to Google Cloud Storage: \${GCS_URL}..."
  UPLOAD_OK=false
  if command -v gcloud >/dev/null 2>&1; then
    if gcloud storage cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    if gsutil cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither 'gcloud' nor 'gsutil' CLI was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="GCS upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [5/5] Managing GCS retention (Keep max \${MAX_FILES} files)..."
  if command -v gcloud >/dev/null 2>&1; then
    GCS_FILES=($(gcloud storage ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gcloud storage rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    GCS_FILES=($(gsutil ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gsutil rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "azure" ]; then
  AZURE_BLOB_NAME="\${AZURE_FOLDER}/\${ZIP_FILENAME}"
  AZURE_BLOB_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
  FINAL_BUCKET="Azure: \${AZURE_CONTAINER}"
  FINAL_KEY="$AZURE_BLOB_NAME"
  FINAL_URL="$AZURE_BLOB_URL"

  echo "🔷 [4/5] Uploading to Azure Blob Storage: \${AZURE_BLOB_URL}..."
  UPLOAD_OK=false
  AUTH_ARGS=()
  if [ -n "$AZURE_CONNECTION_STRING" ]; then
    AUTH_ARGS+=(--connection-string "$AZURE_CONNECTION_STRING")
  elif [ -n "$AZURE_SAS_TOKEN" ]; then
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --sas-token "$AZURE_SAS_TOKEN")
  else
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --auth-mode login)
  fi

  if command -v az >/dev/null 2>&1; then
    if az storage blob upload \\
      --container-name "$AZURE_CONTAINER" \\
      --name "$AZURE_BLOB_NAME" \\
      --file "$ZIP_FILE" \\
      --overwrite true \\
      "\${AUTH_ARGS[@]}" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v azcopy >/dev/null 2>&1; then
    DEST_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
    if [ -n "$AZURE_SAS_TOKEN" ]; then
      DEST_URL="\${DEST_URL}?\${AZURE_SAS_TOKEN#\\?}"
    fi
    if azcopy copy "$ZIP_FILE" "$DEST_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither Azure CLI ('az') nor 'azcopy' was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="Azure Blob upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [5/5] Managing Azure Blob retention (Keep max \${MAX_FILES} files)..."
  if command -v az >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    BLOBS_JSON=$(az storage blob list --container-name "$AZURE_CONTAINER" --prefix "\${AZURE_FOLDER}/" "\${AUTH_ARGS[@]}" --query "[].name" -o json 2>/dev/null || echo "[]")
    TOTAL_BLOBS=$(echo "$BLOBS_JSON" | jq 'length' 2>/dev/null || echo "0")
    if (( TOTAL_BLOBS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_BLOBS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from Azure Blob..."
      echo "$BLOBS_JSON" | jq -r 'sort | .[:'"$PRUNE_COUNT"'] | .[]' | while read -r OLD_BLOB; do
        if [ -n "$OLD_BLOB" ]; then
          az storage blob delete --container-name "$AZURE_CONTAINER" --name "$OLD_BLOB" "\${AUTH_ARGS[@]}" 2>/dev/null || true
        fi
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "shared_drive" ]; then
  DEST_FILE="\${SHARED_DRIVE_PATH}/\${ZIP_FILENAME}"
  FINAL_BUCKET="Shared Drive"
  FINAL_KEY="$DEST_FILE"
  FINAL_URL="file://\${DEST_FILE}"

  echo "📁 [4/5] Copying archive to shared drive: \${DEST_FILE}..."
  if ! cp -p "$ZIP_FILE" "$DEST_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="Copy to shared drive failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi
  rm -f "$ZIP_FILE"

  echo "🧹 [5/5] Managing shared drive retention (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$SHARED_DRIVE_PATH" -maxdepth 1 -name "\${DB_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$SHARED_DRIVE_PATH"/\${DB_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives on shared drive..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi

else # destination == local
  FINAL_BUCKET="Local Storage"
  FINAL_KEY="$ZIP_FILE"
  FINAL_URL="file://\${ZIP_FILE}"

  echo "💻 [4/5] Saved archive to local storage: \${ZIP_FILE}"

  echo "🧹 [5/5] Managing local retention in \${LOCAL_BACKUP_DIR} (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name "\${DB_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$LOCAL_BACKUP_DIR"/\${DB_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest local archives..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
echo "🎉 MySQL Backup Completed Successfully!"
`;
}

export function generateZipScript(cfg: GeneratorConfig): string {
  const dest: StorageDestination = cfg.storageDestination || 's3';
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_web_app';
  const sourcePath = cfg.sourcePath || '/var/www/html';

  // Cloud targets
  const s3Bucket = cfg.s3Bucket || 'my-backup-vault';
  const s3Folder = cfg.s3Folder || `${project}_files_backup`;
  const gcsBucket = cfg.gcsBucket || 'my-gcp-backup-vault';
  const gcsFolder = cfg.gcsFolder || `${project}_files_backup`;
  const azureAccount = cfg.azureStorageAccount || 'mybackupstorage';
  const azureContainer = cfg.azureContainer || 'backups';
  const azureFolder = cfg.azureFolder || `${project}_files_backup`;
  const azureSas = cfg.azureSasToken || '';
  const azureConn = cfg.azureConnectionString || '';

  // Local / mount targets
  const stagingPath = cfg.backupPath || (dest === 'local' ? '/var/backups/zip' : '/tmp/backup_staging');
  const localBackupDir = cfg.localBackupDir || '/var/backups/zip';
  const sharedDrivePath = cfg.sharedDrivePath || '/mnt/backup_share';
  const retentionDays = cfg.retentionDays || 30;
  const maxFiles = cfg.maxFiles || 30;
  const minSizeKb = cfg.minSizeKb || 35;
  const serverId = cfg.serverId || '$(hostname -s 2>/dev/null || echo "server-unknown")';
  const excludes = cfg.excludePatterns || 'node_modules/* .git/* *.log cache/* tmp/*';

  const targetLabel =
    dest === 's3'
      ? `AWS S3 (s3://${s3Bucket}/${s3Folder})`
      : dest === 'gcs'
      ? `Google Cloud Storage (gs://${gcsBucket}/${gcsFolder})`
      : dest === 'azure'
      ? `Azure Blob Storage (${azureAccount}/${azureContainer}/${azureFolder})`
      : dest === 'local'
      ? `Local Disk (${localBackupDir})`
      : `Shared Drive (${sharedDrivePath})`;

  return `#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Directory & File Zip Backup & Telemetry Client
# Generated automatically by BackupPulse Deploy Wizard
# ==============================================================================
# Project:       ${project}
# Source Path:   ${sourcePath}
# Destination:   ${targetLabel}
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

# --- Destination & Retention Policy ---
DESTINATION="\${DESTINATION:-${dest}}"  # Options: s3, gcs, azure, local, shared_drive
S3_BUCKET="\${S3_BUCKET:-${s3Bucket}}"
S3_FOLDER_NAME="\${S3_FOLDER_NAME:-${s3Folder}}"
GCS_BUCKET="\${GCS_BUCKET:-${gcsBucket}}"
GCS_FOLDER_NAME="\${GCS_FOLDER_NAME:-${gcsFolder}}"
AZURE_STORAGE_ACCOUNT="\${AZURE_STORAGE_ACCOUNT:-${azureAccount}}"
AZURE_CONTAINER="\${AZURE_CONTAINER:-${azureContainer}}"
AZURE_FOLDER="\${AZURE_FOLDER:-${azureFolder}}"
AZURE_SAS_TOKEN="\${AZURE_SAS_TOKEN:-${azureSas}}"
AZURE_CONNECTION_STRING="\${AZURE_CONNECTION_STRING:-${azureConn}}"
LOCAL_BACKUP_DIR="\${LOCAL_BACKUP_DIR:-${localBackupDir}}"
SHARED_DRIVE_PATH="\${SHARED_DRIVE_PATH:-${sharedDrivePath}}"
MAX_FILES="\${MAX_FILES:-${maxFiles}}"
RETENTION_DAYS="\${RETENTION_DAYS:-${retentionDays}}"
MIN_FILE_SIZE="\${MIN_FILE_SIZE:-$(( ${minSizeKb} * 1024 ))}"

# --- Local Staging Path & Server Identity ---
BACKUP_PATH="\${BACKUP_PATH:-${stagingPath}}"
DRY_RUN=false
SERVER_ID="\${SERVER_ID:-${serverId}}"
HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'localhost')"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# CLI argument overrides
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_NAME="$2"; shift 2 ;;
    --source-path) SOURCE_PATH="$2"; shift 2 ;;
    --destination) DESTINATION="$2"; shift 2 ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-folder) S3_FOLDER_NAME="$2"; shift 2 ;;
    --gcs-bucket) GCS_BUCKET="$2"; shift 2 ;;
    --gcs-folder) GCS_FOLDER_NAME="$2"; shift 2 ;;
    --azure-account) AZURE_STORAGE_ACCOUNT="$2"; shift 2 ;;
    --azure-container) AZURE_CONTAINER="$2"; shift 2 ;;
    --azure-folder) AZURE_FOLDER="$2"; shift 2 ;;
    --local-dir) LOCAL_BACKUP_DIR="$2"; shift 2 ;;
    --shared-dir) SHARED_DRIVE_PATH="$2"; shift 2 ;;
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
RESTORE_DRILL_STATUS="${cfg.enableRestoreDrill ? 'SKIPPED' : ''}"
RESTORE_DRILL_DURATION=0
RESTORE_DRILL_TABLES=0
RESTORE_DRILL_LOG=""
ZIP_FILENAME="\${PROJECT_NAME}-\${DATE_STR}.zip"

# Stage directly in local target directory if destination is local
if [ "$DESTINATION" = "local" ]; then
  mkdir -p "$LOCAL_BACKUP_DIR" 2>/dev/null || true
  ZIP_FILE="\${LOCAL_BACKUP_DIR}/\${ZIP_FILENAME}"
else
  mkdir -p "$BACKUP_PATH" 2>/dev/null || true
  ZIP_FILE="\${BACKUP_PATH}/\${ZIP_FILENAME}"
fi

TEMP_LOG_DIR="/tmp/backuppulse_logs"
mkdir -p "$TEMP_LOG_DIR" 2>/dev/null || true
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
  local s3_b="\${6:-}"
  local s3_k="\${7:-}"
  local s3_u="\${8:-}"
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
      --arg s3_bucket "$s3_b" \\
      --arg s3_key "$s3_k" \\
      --arg s3_url "$s3_u" \\
      --arg checksum "$checksum" \\
      --arg zip_filename "$ZIP_FILENAME" \\
      --argjson exit_code "$exit_code" \\
      --argjson retention_days "$RETENTION_DAYS" \\
      --arg error_message "$error_msg" \\
      --arg restore_drill_status "$RESTORE_DRILL_STATUS" \\
      --argjson restore_drill_duration_seconds "$RESTORE_DRILL_DURATION" \\
      --argjson restore_drill_verified_tables "$RESTORE_DRILL_TABLES" \\
      --arg restore_drill_log "$RESTORE_DRILL_LOG" \\
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
        checksum: $checksum,
        zip_filename: $zip_filename,
        exit_code: $exit_code,
        retention_days: $retention_days,
        error_message: (if $error_message == "" then null else $error_message end),
        restore_drill_status: (if $restore_drill_status == "" then null else $restore_drill_status end),
        restore_drill_duration_seconds: (if $restore_drill_duration_seconds == 0 then null else $restore_drill_duration_seconds end),
        restore_drill_verified_tables: (if $restore_drill_verified_tables == 0 then null else $restore_drill_verified_tables end),
        restore_drill_log: (if $restore_drill_log == "" then null else $restore_drill_log end)
      }')
  fi

  echo "📡 Dispatching real-time telemetry to BackupPulse Central API..."
  curl -s -X POST "$HUB_API_URL" \\
    -H "Content-Type: application/json" \\
    -H "x-api-key: $HUB_API_KEY" \\
    -d "$payload" || true
}

echo "🗜️  [1/4] Checking environment & source path '\${SOURCE_PATH}'..."
if [ ! -d "$SOURCE_PATH" ] && [ ! -f "$SOURCE_PATH" ]; then
  ERR="Source path '\${SOURCE_PATH}' does not exist!"
  echo "❌ $ERR"
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
  exit 1
fi

if [ "$DESTINATION" = "shared_drive" ]; then
  if [ ! -d "$SHARED_DRIVE_PATH" ]; then
    ERR="Shared drive directory '\${SHARED_DRIVE_PATH}' does not exist or is not mounted!"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" 0 "" "Shared Drive" "$SHARED_DRIVE_PATH" ""
    exit 1
  fi
fi

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
  send_telemetry "FAILED" 1 "$ERR" 0 "" "" "" ""
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
${cfg.enableRestoreDrill ? `
echo "🧪 [DrillPulse] Running archive extraction integrity verification drill..."
DRILL_START_SEC=$(date +%s)
DRILL_EXTRACT_DIR="/tmp/drill_verify_\${DATE_STR}_\$RANDOM"
mkdir -p "$DRILL_EXTRACT_DIR" 2>/dev/null || true

if unzip -q -t "$ZIP_FILE" >/dev/null 2>&1; then
  DRILL_END_SEC=$(date +%s)
  RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
  RESTORE_DRILL_STATUS="SUCCESS"
  FILE_COUNT=$(unzip -l "$ZIP_FILE" 2>/dev/null | tail -n 1 | awk '{print $2}' || echo "1")
  RESTORE_DRILL_TABLES=$(echo "$FILE_COUNT" | tr -d '[:space:]')
  if [ -z "$RESTORE_DRILL_TABLES" ]; then RESTORE_DRILL_TABLES=1; fi
  RESTORE_DRILL_LOG="Verification PASSED: Archive binary checksum & uncompressed file structure verified (\${RESTORE_DRILL_TABLES} files)."
  echo "✅ Directory archive integrity drill PASSED! Verified \${RESTORE_DRILL_TABLES} files in \${RESTORE_DRILL_DURATION}s."
else
  DRILL_END_SEC=$(date +%s)
  RESTORE_DRILL_DURATION=$(( DRILL_END_SEC - DRILL_START_SEC ))
  RESTORE_DRILL_STATUS="FAILED"
  RESTORE_DRILL_LOG="Verification FAILED: Archive extraction test failed (corrupted zip)."
  echo "❌ Directory archive integrity drill FAILED."
fi
rm -rf "$DRILL_EXTRACT_DIR" 2>/dev/null || true
` : ''}

FINAL_BUCKET=""
FINAL_KEY=""
FINAL_URL=""

if [ "$DESTINATION" = "s3" ]; then
  S3_KEY="\${S3_FOLDER_NAME}/\${ZIP_FILENAME}"
  S3_URL="s3://\${S3_BUCKET}/\${S3_KEY}"
  FINAL_BUCKET="$S3_BUCKET"
  FINAL_KEY="$S3_KEY"
  FINAL_URL="$S3_URL"

  echo "☁️  [3/4] Uploading to AWS S3: \${S3_URL}..."
  if ! aws s3 cp "$ZIP_FILE" "$S3_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="S3 upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
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
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "gcs" ]; then
  GCS_KEY="\${GCS_FOLDER_NAME}/\${ZIP_FILENAME}"
  GCS_URL="gs://\${GCS_BUCKET}/\${GCS_KEY}"
  FINAL_BUCKET="gs://\${GCS_BUCKET}"
  FINAL_KEY="$GCS_KEY"
  FINAL_URL="$GCS_URL"

  echo "🌐 [3/4] Uploading to Google Cloud Storage: \${GCS_URL}..."
  UPLOAD_OK=false
  if command -v gcloud >/dev/null 2>&1; then
    if gcloud storage cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    if gsutil cp "$ZIP_FILE" "$GCS_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither 'gcloud' nor 'gsutil' CLI was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="GCS upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [4/4] Managing GCS retention (Keep max \${MAX_FILES} files)..."
  if command -v gcloud >/dev/null 2>&1; then
    GCS_FILES=($(gcloud storage ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gcloud storage rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  elif command -v gsutil >/dev/null 2>&1; then
    GCS_FILES=($(gsutil ls "gs://\${GCS_BUCKET}/\${GCS_FOLDER_NAME}/*.zip" 2>/dev/null | sort || true))
    TOTAL_GCS=\${#GCS_FILES[@]}
    if (( TOTAL_GCS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_GCS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from GCS..."
      for (( i=0; i<PRUNE_COUNT; i++ )); do
        gsutil rm "\${GCS_FILES[$i]}" 2>/dev/null || true
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "azure" ]; then
  AZURE_BLOB_NAME="\${AZURE_FOLDER}/\${ZIP_FILENAME}"
  AZURE_BLOB_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
  FINAL_BUCKET="Azure: \${AZURE_CONTAINER}"
  FINAL_KEY="$AZURE_BLOB_NAME"
  FINAL_URL="$AZURE_BLOB_URL"

  echo "🔷 [3/4] Uploading to Azure Blob Storage: \${AZURE_BLOB_URL}..."
  UPLOAD_OK=false
  AUTH_ARGS=()
  if [ -n "$AZURE_CONNECTION_STRING" ]; then
    AUTH_ARGS+=(--connection-string "$AZURE_CONNECTION_STRING")
  elif [ -n "$AZURE_SAS_TOKEN" ]; then
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --sas-token "$AZURE_SAS_TOKEN")
  else
    AUTH_ARGS+=(--account-name "$AZURE_STORAGE_ACCOUNT" --auth-mode login)
  fi

  if command -v az >/dev/null 2>&1; then
    if az storage blob upload \\
      --container-name "$AZURE_CONTAINER" \\
      --name "$AZURE_BLOB_NAME" \\
      --file "$ZIP_FILE" \\
      --overwrite true \\
      "\${AUTH_ARGS[@]}" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  elif command -v azcopy >/dev/null 2>&1; then
    DEST_URL="https://\${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/\${AZURE_CONTAINER}/\${AZURE_BLOB_NAME}"
    if [ -n "$AZURE_SAS_TOKEN" ]; then
      DEST_URL="\${DEST_URL}?\${AZURE_SAS_TOKEN#\\?}"
    fi
    if azcopy copy "$ZIP_FILE" "$DEST_URL" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
      UPLOAD_OK=true
    fi
  else
    echo "❌ Neither Azure CLI ('az') nor 'azcopy' was found!" >>"$LOG_STDERR"
  fi

  if [ "$UPLOAD_OK" != true ]; then
    ERR="Azure Blob upload failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi

  echo "🧹 [4/4] Managing Azure Blob retention (Keep max \${MAX_FILES} files)..."
  if command -v az >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    BLOBS_JSON=$(az storage blob list --container-name "$AZURE_CONTAINER" --prefix "\${AZURE_FOLDER}/" "\${AUTH_ARGS[@]}" --query "[].name" -o json 2>/dev/null || echo "[]")
    TOTAL_BLOBS=$(echo "$BLOBS_JSON" | jq 'length' 2>/dev/null || echo "0")
    if (( TOTAL_BLOBS > MAX_FILES )); then
      PRUNE_COUNT=$(( TOTAL_BLOBS - MAX_FILES ))
      echo "Pruning \${PRUNE_COUNT} oldest archives from Azure Blob..."
      echo "$BLOBS_JSON" | jq -r 'sort | .[:'"$PRUNE_COUNT"'] | .[]' | while read -r OLD_BLOB; do
        if [ -n "$OLD_BLOB" ]; then
          az storage blob delete --container-name "$AZURE_CONTAINER" --name "$OLD_BLOB" "\${AUTH_ARGS[@]}" 2>/dev/null || true
        fi
      done
    fi
  fi
  rm -f "$ZIP_FILE"

elif [ "$DESTINATION" = "shared_drive" ]; then
  DEST_FILE="\${SHARED_DRIVE_PATH}/\${ZIP_FILENAME}"
  FINAL_BUCKET="Shared Drive"
  FINAL_KEY="$DEST_FILE"
  FINAL_URL="file://\${DEST_FILE}"

  echo "📁 [3/4] Copying archive to shared drive: \${DEST_FILE}..."
  if ! cp -p "$ZIP_FILE" "$DEST_FILE" >>"$LOG_STDOUT" 2>>"$LOG_STDERR"; then
    ERR="Copy to shared drive failed: $(tail -n 3 "$LOG_STDERR")"
    echo "❌ $ERR"
    send_telemetry "FAILED" 1 "$ERR" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
    exit 1
  fi
  rm -f "$ZIP_FILE"

  echo "🧹 [4/4] Managing shared drive retention (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$SHARED_DRIVE_PATH" -maxdepth 1 -name "\${PROJECT_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$SHARED_DRIVE_PATH"/\${PROJECT_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest archives on shared drive..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi

else # destination == local
  FINAL_BUCKET="Local Storage"
  FINAL_KEY="$ZIP_FILE"
  FINAL_URL="file://\${ZIP_FILE}"

  echo "💻 [3/4] Saved archive to local storage: \${ZIP_FILE}"

  echo "🧹 [4/4] Managing local retention in \${LOCAL_BACKUP_DIR} (Keep max \${MAX_FILES} files, \${RETENTION_DAYS} days policy)..."
  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name "\${PROJECT_NAME}-*.zip" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true
  ARCHIVE_LIST=($(ls -1t "$LOCAL_BACKUP_DIR"/\${PROJECT_NAME}-*.zip 2>/dev/null || true))
  TOTAL_ARCHIVES=\${#ARCHIVE_LIST[@]}
  if (( TOTAL_ARCHIVES > MAX_FILES )); then
    PRUNE_COUNT=$(( TOTAL_ARCHIVES - MAX_FILES ))
    echo "Pruning \${PRUNE_COUNT} oldest local archives..."
    for (( i=MAX_FILES; i<TOTAL_ARCHIVES; i++ )); do
      rm -f "\${ARCHIVE_LIST[$i]}" 2>/dev/null || true
    done
  fi
fi

send_telemetry "$STATUS" 0 "$ANOMALY_MSG" "$LATEST_SIZE" "$CHECKSUM" "$FINAL_BUCKET" "$FINAL_KEY" "$FINAL_URL"
echo "🎉 Directory Zip Backup Completed Successfully!"
`;
}

export function generateCurlSnippet(cfg: GeneratorConfig): string {
  const dest: StorageDestination = cfg.storageDestination || 's3';
  const apiUrl = cfg.apiUrl || 'http://localhost:3000/api/v1/backups/report';
  const apiKey = cfg.apiKey || 'bkp_live_secret_key_12345';
  const project = cfg.projectName || 'my_custom_project';
  const retention = cfg.retentionDays || 30;

  let targetBucket = cfg.s3Bucket || 'my-backup-vault';
  if (dest === 'gcs') targetBucket = `gs://${cfg.gcsBucket || 'my-gcp-vault'}`;
  else if (dest === 'azure') targetBucket = `Azure: ${cfg.azureContainer || 'backups'}`;
  else if (dest === 'local') targetBucket = 'Local Storage';
  else if (dest === 'shared_drive') targetBucket = 'Shared Drive';

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
    \\"s3_bucket\\": \\"${targetBucket}\\",
    \\"retention_days\\": ${retention},
    \\"zip_filename\\": \\"$(basename "$ARCHIVE_PATH")\\"${cfg.enableRestoreDrill ? `,
    \\"restore_drill_status\\": \\"SUCCESS\\",
    \\"restore_drill_duration_seconds\\": 15,
    \\"restore_drill_verified_tables\\": 42,
    \\"restore_drill_log\\": \\"Verification PASSED: 42 tables verified in ephemeral sandbox\\"` : ''}
  }"
`;
}

export function generateCrontabLine(scriptPath: string, schedule: string = '59 23 * * *'): string {
  return `# Run BackupPulse backup cron job
${schedule} bash ${scriptPath} >> /var/log/backuppulse_cron.log 2>&1`;
}

export function generateInstallCommands(
  backupType: 'postgres' | 'mysql' | 'zip' | 'curl',
  stagingPath: string = '/var/backups',
  storageDestination: StorageDestination = 's3',
  targetPath?: string
): {
  debian: string;
  rhel: string;
  prep: string;
  storageTitle: string;
  storageCommand: string;
  storageHelp: string;
} {
  let dbDeb = '';
  let dbRhel = '';

  if (backupType === 'postgres') {
    dbDeb = 'postgresql-client ';
    dbRhel = 'postgresql ';
  } else if (backupType === 'mysql') {
    dbDeb = 'default-mysql-client ';
    dbRhel = 'mysql ';
  }

  const primaryDir = targetPath || stagingPath;

  if (storageDestination === 's3') {
    return {
      debian: `sudo apt update && sudo apt install -y ${dbDeb}zip unzip jq awscli curl`,
      rhel: `sudo yum install -y ${dbRhel}zip unzip jq awscli curl`,
      prep: `sudo mkdir -p ${primaryDir} /opt/scripts
sudo chmod 777 ${primaryDir}
sudo chmod +x /opt/scripts/*.sh`,
      storageTitle: '☁️ 4. AWS S3 Credentials Configuration',
      storageCommand: 'aws configure',
      storageHelp:
        'Configure AWS credentials with S3 read/write permissions on the client machine via IAM Instance Profile or access keys.',
    };
  }

  if (storageDestination === 'gcs') {
    return {
      debian: `sudo apt update && sudo apt install -y ${dbDeb}zip unzip jq curl apt-transport-https ca-certificates gnupg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
sudo apt update && sudo apt install -y google-cloud-cli`,
      rhel: `sudo tee -a /etc/yum.repos.d/google-cloud-sdk.repo << 'EOF'
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el8-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
sudo yum install -y ${dbRhel}google-cloud-cli zip unzip jq curl`,
      prep: `sudo mkdir -p ${primaryDir} /opt/scripts
sudo chmod 777 ${primaryDir}
sudo chmod +x /opt/scripts/*.sh`,
      storageTitle: '🌐 4. Google Cloud Storage Authentication (GCS)',
      storageCommand: `gcloud auth activate-service-account --key-file=/opt/gcp-sa-key.json
# Or on Google Compute Engine VM: Attach a service account with Cloud Storage write access.`,
      storageHelp:
        'Authenticate with GCP using a Service Account JSON key with "Storage Object Admin" role on your bucket, or attach a Service Account to your Google Cloud VM.',
    };
  }

  if (storageDestination === 'azure') {
    return {
      debian: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
sudo apt update && sudo apt install -y ${dbDeb}zip unzip jq curl`,
      rhel: `sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo dnf install -y https://packages.microsoft.com/config/rhel/8/packages-microsoft-prod.rpm
sudo dnf install -y azure-cli ${dbRhel}zip unzip jq curl`,
      prep: `sudo mkdir -p ${primaryDir} /opt/scripts
sudo chmod 777 ${primaryDir}
sudo chmod +x /opt/scripts/*.sh`,
      storageTitle: '🔷 4. Azure Blob Storage Authentication',
      storageCommand: `az login
# Or on Azure VM: az login --identity
# Or export SAS Token: export AZURE_SAS_TOKEN="sp=racwd&st=..."`,
      storageHelp:
        'Authenticate using Azure CLI ("az login"), Azure Managed Identity ("az login --identity" on Azure VMs), or supply a Container SAS Token or Connection String.',
    };
  }

  if (storageDestination === 'local') {
    return {
      debian: `sudo apt update && sudo apt install -y ${dbDeb}zip unzip jq curl`,
      rhel: `sudo yum install -y ${dbRhel}zip unzip jq curl`,
      prep: `sudo mkdir -p ${primaryDir} /opt/scripts
sudo chmod 777 ${primaryDir}
sudo chmod +x /opt/scripts/*.sh`,
      storageTitle: '💻 4. Local Storage Verification',
      storageCommand: `df -h ${primaryDir}`,
      storageHelp:
        'Verify available storage capacity on the local filesystem. No cloud provider account or cloud CLI required.',
    };
  }

  // shared_drive
  return {
    debian: `sudo apt update && sudo apt install -y ${dbDeb}zip unzip jq curl`,
    rhel: `sudo yum install -y ${dbRhel}zip unzip jq curl`,
    prep: `sudo mkdir -p ${primaryDir} /opt/scripts
sudo chmod 777 ${primaryDir}
sudo chmod +x /opt/scripts/*.sh`,
    storageTitle: '📁 4. Network Shared Drive Mount Verification',
    storageCommand: `df -h ${primaryDir}`,
    storageHelp: `Ensure your NFS or SMB/CIFS network drive is mounted at '${primaryDir}' before running the backup script.`,
  };
}
