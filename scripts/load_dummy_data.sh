#!/usr/bin/env bash
# ==============================================================================
# BackupPulse — Interactive Dummy Data Generator & Scenario Simulator
# ==============================================================================
# This script loads comprehensive dummy data with all possible backup scenarios,
# error logs, project types, and multi-day telemetry into the BackupPulse API.
# ==============================================================================

# Text Formatting & Colors
BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RESET='\033[0m'

# Auto-detect configuration from .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

DEFAULT_API_URL="http://localhost:3000/api/v1/backups/report"
DEFAULT_API_KEY="bkp_live_secret_key_12345"

if [ -f "$ENV_FILE" ]; then
  ENV_KEY="$(grep -E '^INGESTION_API_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d ' "\r')"
  ENV_PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d'=' -f2- | tr -d ' "\r')"
  [ -n "$ENV_KEY" ] && DEFAULT_API_KEY="$ENV_KEY"
  [ -n "$ENV_PORT" ] && DEFAULT_API_URL="http://localhost:${ENV_PORT}/api/v1/backups/report"
fi

API_URL="${API_URL:-$DEFAULT_API_URL}"
API_KEY="${API_KEY:-$DEFAULT_API_KEY}"

# Helper to check API connectivity
check_health() {
  local health_url="${API_URL%/api/v1/backups/report}/health"
  echo -e "${CYAN}[*] Verifying connectivity to ${health_url}...${RESET}"
  local resp
  resp="$(curl -s -m 5 "$health_url" 2>/dev/null)"
  if [[ "$resp" == *"\"status\":\"ok\""* ]] || [[ "$resp" == *"status"* ]]; then
    echo -e "${GREEN}[+] Connection verified! API server is healthy and online.${RESET}\n"
    return 0
  else
    echo -e "${YELLOW}[!] Warning: Could not reach health check at ${health_url}.${RESET}"
    echo -e "${YELLOW}    Make sure BackupPulse is running (e.g. docker compose up -d).${RESET}"
    read -rp "Continue anyway? (y/N): " cont
    if [[ ! "$cont" =~ ^[yY]$ ]]; then
      echo "Aborted."
      exit 1
    fi
    echo ""
    return 1
  fi
}

# Helper to send a single backup report
send_report() {
  local server_id="$1"
  local hostname="$2"
  local ip="$3"
  local project="$4"
  local env="$5"
  local bkp_type="$6"
  local status="$7"
  local start_iso="$8"
  local end_iso="$9"
  local duration="${10}"
  local size_bytes="${11}"
  local size_human="${12}"
  local s3_bucket="${13}"
  local s3_key="${14}"
  local checksum="${15}"
  local filename="${16}"
  local exit_code="${17}"
  local err_msg="${18}"
  local stdout_log="${19}"
  local stderr_log="${20}"

  local err_field="null"
  [ -n "$err_msg" ] && err_field="\"$(echo "$err_msg" | sed 's/"/\\"/g')\""

  local stdout_field="null"
  [ -n "$stdout_log" ] && stdout_field="\"$(echo "$stdout_log" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\r\n')\""

  local stderr_field="null"
  [ -n "$stderr_log" ] && stderr_field="\"$(echo "$stderr_log" | sed 's/"/\\"/g; s/$/\\n/' | tr -d '\r\n')\""

  local payload=$(cat <<EOF
{
  "server_id": "${server_id}",
  "hostname": "${hostname}",
  "server_ip": "${ip}",
  "project_name": "${project}",
  "environment": "${env}",
  "backup_type": "${bkp_type}",
  "status": "${status}",
  "start_time": "${start_iso}",
  "end_time": "${end_iso}",
  "duration_seconds": ${duration},
  "backup_size_bytes": ${size_bytes},
  "backup_size_human": "${size_human}",
  "s3_bucket": "${s3_bucket}",
  "s3_key": "${s3_key}",
  "s3_url": "s3://${s3_bucket}/${s3_key}",
  "checksum": "${checksum}",
  "zip_filename": "${filename}",
  "exit_code": ${exit_code},
  "error_message": ${err_field},
  "stdout_log": ${stdout_field},
  "stderr_log": ${stderr_field},
  "metadata": {
    "generator": "BackupPulse-Dummy-Agent",
    "simulated": true
  }
}
EOF
)

  local http_code
  http_code="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "$payload" \
    --connect-timeout 5 \
    --max-time 15)"

  if [[ "$http_code" =~ ^20[0-9]$ ]]; then
    return 0
  else
    return 1
  fi
}

# ------------------------------------------------------------------------------
# SCENARIO 1: Full Realistic Production Dataset (Multi-day, 45+ reports)
# ------------------------------------------------------------------------------
load_full_production_dataset() {
  echo -e "\n${BOLD}${CYAN}=== Generating Full Production Telemetry Dataset ===${RESET}"
  echo -e "Spanning across 10 projects, 15 servers, and the past 7 days..."

  local projects=("ecommerce-core" "payment-gateway" "auth-identity-svc" "inventory-warehouse" "notification-engine" "billing-service" "crm-portal" "analytics-pipeline")
  local servers=("srv-us-east-01" "srv-us-east-02" "srv-us-west-01" "srv-eu-west-01" "srv-eu-central-01" "srv-ap-south-01" "srv-ap-southeast-01")
  local types=("db" "code" "full")
  local bucket="company-cloud-backups-prod"

  local total=40
  local success_count=0
  local fail_count=0

  for ((i=1; i<=total; i++)); do
    local proj="${projects[$(( (i - 1) % ${#projects[@]} ))]}"
    local srv="${servers[$(( (i - 1) % ${#servers[@]} ))]}"
    local btype="${types[$(( (i - 1) % ${#types[@]} ))]}"
    local env="production"
    local ip="10.0.$(( (i % 5) + 1 )).$(( 10 + i ))"
    local hostname="${srv}.${env}.internal"

    # Time distribution over past 7 days (earlier i = more recent)
    local hours_ago=$(( (total - i) * 4 ))
    local start_ts=$(date -u -d "$hours_ago hours ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
    local duration=$(( 45 + (i * 17) % 600 ))
    local end_ts=$(date -u -d "$((hours_ago - 1)) hours ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

    local status="SUCCESS"
    local exit_code=0
    local err_msg=""
    local stderr_log=""
    local stdout_log="Dump initiated.\nArchive created successfully.\nUpload completed to S3 with 200 OK."
    local size_bytes=$(( (150 + (i * 73) % 2500) * 1024 * 1024 )) # 150MB - 2.5GB
    local size_human="$(awk "BEGIN {printf \"%.2f GB\", $size_bytes/(1024*1024*1024)}")"
    local filename="${proj}_${btype}_$(date +%Y%m%d_%H%M%S)_${i}.tar.gz"
    local s3_key="${proj}/$(date +%Y-%m-%d)/${filename}"
    local checksum="e$(printf '%031x' $((i * 987654321)))"

    # Inject realistic failure cases
    if [ "$i" -eq 7 ]; then
      status="FAILED"
      exit_code=28
      err_msg="mysqldump: Got errno 28 (No space left on device) during table dump"
      stderr_log="mysqldump: Error writing file '/tmp/dump.sql' (OS errno 28 - No space left on device)"
      size_bytes=0
      size_human="0 B"
      checksum=""
    elif [ "$i" -eq 18 ]; then
      status="FAILED"
      exit_code=1
      err_msg="AWS S3 upload failed: RequestTimeout (Connection to bucket endpoint timed out after 30s)"
      stderr_log="upload failed: ./backup.tar.gz to s3://${bucket}/... RequestTimeout: Your socket connection to the server was not read from or written to within the timeout period."
      checksum="d41d8cd98f00b204e9800998ecf8427e"
    elif [ "$i" -eq 29 ]; then
      status="FAILED"
      exit_code=2
      err_msg="pg_dump: error: connection to server was lost (FATAL: server closed the connection unexpectedly)"
      stderr_log="pg_dump: error: query failed: SSL connection has been closed unexpectedly"
      size_bytes=0
      size_human="0 B"
      checksum=""
    elif [ "$i" -eq 36 ]; then
      status="WARNING"
      exit_code=0
      err_msg="Archive completed with warnings: tar reported 3 files modified during read"
      stdout_log="tar: /var/www/code/session.log: file changed as we read it\nBackup finished with non-fatal warnings."
    fi

    echo -ne "  [${i}/${total}] Ingesting ${proj} on ${srv} (${status})... "
    if send_report "$srv" "$hostname" "$ip" "$proj" "$env" "$btype" "$status" \
                   "$start_ts" "$end_ts" "$duration" "$size_bytes" "$size_human" \
                   "$bucket" "$s3_key" "$checksum" "$filename" "$exit_code" \
                   "$err_msg" "$stdout_log" "$stderr_log"; then
      if [ "$status" == "SUCCESS" ]; then
        echo -e "${GREEN}✓ Done${RESET}"
        ((success_count++))
      elif [ "$status" == "FAILED" ]; then
        echo -e "${RED}✗ Failed Report Recorded${RESET}"
        ((fail_count++))
      else
        echo -e "${YELLOW}⚠ Warning Recorded${RESET}"
      fi
    else
      echo -e "${RED}HTTP Error! Check API_URL / API_KEY.${RESET}"
    fi
    sleep 0.1
  done

  echo -e "\n${GREEN}${BOLD}✔ Done! Ingested ${total} reports (${success_count} Passed, ${fail_count} Failures).${RESET}"
}

# ------------------------------------------------------------------------------
# SCENARIO 2: Failure Alert Simulation
# ------------------------------------------------------------------------------
simulate_failure_scenarios() {
  echo -e "\n${BOLD}${RED}=== Simulating Realistic Failure Scenarios ===${RESET}"
  echo "Injecting 5 distinct error conditions across different stacks..."

  local failures=(
    "database-vault|srv-db-01|db|PostgreSQL 16|pg_dump: error: connection to server on socket '/var/run/postgresql' failed: FATAL: remaining connection slots are reserved for non-replication superuser connections|53300"
    "ecommerce-media|srv-media-03|code|Static Assets|tar: /data/uploads/image_9918.png: Read error: Input/output error on block device /dev/sdb1|5"
    "redis-cache|srv-cache-02|db|Redis RDB|BGSAVE failed: Background saving error (Can't save in background: fork: Cannot allocate memory)|12"
    "auth-service|srv-k8s-node-4|full|Microservice Node|AWS S3 upload error: 403 Forbidden - AccessDenied: User is not authorized to perform: s3:PutObject on resource|1"
    "analytics-clickhouse|srv-bigdata-01|db|ClickHouse DB|Checksum mismatch: calculated SHA256 '8bfa0...' does not match archive 'c3411...'. Data corruption detected.|3"
  )

  local count=0
  for item in "${failures[@]}"; do
    ((count++))
    IFS='|' read -r proj srv btype stack error_msg exit_code <<< "$item"
    local now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    local filename="${proj}_FAILED_$(date +%Y%m%d_%H%M%S).tar.gz"

    echo -ne "  [${count}/5] Sending failure: [${proj}] ${error_msg:0:45}... "
    if send_report "$srv" "${srv}.prod.net" "10.0.9.${count}" "$proj" "production" "$btype" "FAILED" \
                   "$now_iso" "$now_iso" 45 0 "0 B" "backup-vault" "failures/${filename}" \
                   "" "$filename" "$exit_code" "$error_msg" \
                   "Initiated backup routine for ${stack}." "$error_msg"; then
      echo -e "${RED}✓ Failure Alert Registered${RESET}"
    else
      echo -e "${RED}✗ Failed to send${RESET}"
    fi
    sleep 0.2
  done
  echo -e "\n${GREEN}✔ Failure scenarios generated! Check Dashboard and Google Chat.${RESET}"
}

# ------------------------------------------------------------------------------
# SCENARIO 3: Single Live Ingestion Test
# ------------------------------------------------------------------------------
single_report_test() {
  echo -e "\n${BOLD}${BLUE}=== Single Live Ingestion Test ===${RESET}"
  echo "Choose result type for this single report:"
  echo "  1) SUCCESS (Normal backup completed)"
  echo "  2) FAILED (Backup error condition)"
  read -rp "Select option (1-2) [1]: " sub_opt
  sub_opt="${sub_opt:-1}"

  read -rp "Enter Project Name [sample-api]: " custom_proj
  custom_proj="${custom_proj:-sample-api}"

  read -rp "Enter Server ID [srv-demo-01]: " custom_srv
  custom_srv="${custom_srv:-srv-demo-01}"

  local now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local status="SUCCESS"
  local err_msg=""
  local exit_code=0
  local size_bytes=524288000 # 500MB
  local size_human="500.00 MB"

  if [ "$sub_opt" == "2" ]; then
    status="FAILED"
    err_msg="Manual test trigger: Simulated backup process termination"
    exit_code=1
    size_bytes=0
    size_human="0 B"
  fi

  local filename="${custom_proj}_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
  echo -e "\n${CYAN}[*] Sending ${status} report for ${custom_proj} on ${custom_srv}...${RESET}"

  if send_report "$custom_srv" "${custom_srv}.local" "192.168.1.100" "$custom_proj" "production" "full" "$status" \
                 "$now_iso" "$now_iso" 120 "$size_bytes" "$size_human" \
                 "demo-bucket" "${custom_proj}/${filename}" "f8b92c4e..." "$filename" "$exit_code" \
                 "$err_msg" "Manual diagnostic test executed via CLI." "$err_msg"; then
    echo -e "${GREEN}${BOLD}✔ Successfully ingested! Visit dashboard to view your new report.${RESET}"
  else
    echo -e "${RED}${BOLD}✗ Ingestion failed! Check your API_URL (${API_URL}) and API_KEY.${RESET}"
  fi
}

# ------------------------------------------------------------------------------
# SCENARIO 4: High-Volume Multi-Server Simulation (100 Servers)
# ------------------------------------------------------------------------------
high_volume_simulation() {
  echo -e "\n${BOLD}${PURPLE}=== 100-Server Fleet Simulation ===${RESET}"
  echo "This will simulate an entire cluster of 100 servers sending backup telemetry in parallel/rapid sequence."
  read -rp "Proceed with 100 reports? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Cancelled."
    return
  fi

  local total=100
  echo -e "${CYAN}[*] Dispatching 100 backup events...${RESET}"
  for ((i=1; i<=total; i++)); do
    local srv_num=$(printf "%03d" "$i")
    local srv="srv-prod-${srv_num}"
    local proj="app-tier-$(( (i % 8) + 1 ))"
    local now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    local is_fail=$(( i % 15 == 0 ? 1 : 0 ))
    local status="SUCCESS"
    local err_msg=""
    local exit_code=0
    local size_bytes=$(( 100 * 1024 * 1024 + (i * 1024 * 1024 * 50) ))
    local size_human="$(awk "BEGIN {printf \"%.2f MB\", $size_bytes/(1024*1024)}")"

    if [ "$is_fail" -eq 1 ]; then
      status="FAILED"
      err_msg="Connection reset during S3 multi-part upload on host ${srv}"
      exit_code=104
      size_bytes=0
      size_human="0 B"
    fi

    send_report "$srv" "${srv}.internal" "10.100.$((i / 254)).$((i % 254))" "$proj" "production" "full" "$status" \
                "$now_iso" "$now_iso" 90 "$size_bytes" "$size_human" \
                "enterprise-vault" "${proj}/${srv}.tar.gz" "hash_${i}" "${srv}.tar.gz" "$exit_code" \
                "$err_msg" "Daily cron job finished" "$err_msg" &

    # Batch 10 concurrent requests
    if (( i % 10 == 0 )); then
      wait
      echo -ne "  -> Ingested ${i}/${total} server reports...\r"
    fi
  done
  wait
  echo -e "\n${GREEN}${BOLD}✔ Successfully completed 100-server telemetry batch!${RESET}"
}

# ------------------------------------------------------------------------------
# Interactive Menu Loop
# ------------------------------------------------------------------------------
show_menu() {
  clear
  echo -e "${BOLD}${CYAN}========================================================================${RESET}"
  echo -e "${BOLD}${GREEN}        🛡️  BackupPulse — Dummy Telemetry & Scenario Generator         ${RESET}"
  echo -e "${BOLD}${CYAN}========================================================================${RESET}"
  echo -e " Target Ingestion API : ${YELLOW}${API_URL}${RESET}"
  echo -e " Configured API Key   : ${PURPLE}${API_KEY:0:8}********${RESET}"
  echo -e "${CYAN}------------------------------------------------------------------------${RESET}"
  echo -e " ${BOLD}Select a scenario to load into your dashboard:${RESET}"
  echo ""
  echo -e "  ${GREEN}[1]${RESET} 🌟 ${BOLD}Full Production Dataset${RESET} (40+ reports across 10 projects, 7 days trend)"
  echo -e "  ${RED}[2]${RESET} 🚨 ${BOLD}Failure Scenarios Only${RESET} (5 realistic crashes: out-of-disk, timeout, etc.)"
  echo -e "  ${BLUE}[3]${RESET} ⚡ ${BOLD}Single Report Test${RESET} (Quick interactive 1-click test)"
  echo -e "  ${PURPLE}[4]${RESET} 🚀 ${BOLD}100-Server Fleet Simulation${RESET} (Stress test with 100 servers)"
  echo -e "  ${YELLOW}[5]${RESET} ⚙️  ${BOLD}Change API URL or API Key${RESET}"
  echo -e "  ${RESET}[0]${RESET} ❌ ${BOLD}Exit${RESET}"
  echo -e "${CYAN}------------------------------------------------------------------------${RESET}"
  read -rp "Enter choice [1-5, 0]: " choice
}

# Entrypoint
check_health

while true; do
  show_menu
  case "$choice" in
    1)
      load_full_production_dataset
      read -rp $'\nPress [Enter] to return to menu...'
      ;;
    2)
      simulate_failure_scenarios
      read -rp $'\nPress [Enter] to return to menu...'
      ;;
    3)
      single_report_test
      read -rp $'\nPress [Enter] to return to menu...'
      ;;
    4)
      high_volume_simulation
      read -rp $'\nPress [Enter] to return to menu...'
      ;;
    5)
      echo ""
      read -rp "Enter new API URL [${API_URL}]: " new_url
      [ -n "$new_url" ] && API_URL="$new_url"
      read -rp "Enter new API Key [${API_KEY}]: " new_key
      [ -n "$new_key" ] && API_KEY="$new_key"
      echo -e "${GREEN}Configuration updated!${RESET}"
      sleep 1
      ;;
    0|q|Q|exit)
      echo -e "\n${CYAN}Exiting. Have a great day!${RESET}"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid selection. Please choose 1, 2, 3, 4, 5, or 0.${RESET}"
      sleep 1
      ;;
  esac
done
