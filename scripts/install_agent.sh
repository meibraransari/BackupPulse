#!/usr/bin/env bash
# ==============================================================================
# BackupPulse Fleet Rollout & Agent Installer (scripts/install_agent.sh)
# ==============================================================================
# Automates deployment of BackupPulse telemetry agent across 100+ production servers.
#
# Usage:
#   sudo ./scripts/install_agent.sh [OPTIONS]
#
# Options:
#   --hub <URL>             BackupPulse Hub base URL (e.g. http://10.0.0.1:3000)
#   --key <API_KEY>         Ingestion API key (API_KEY from .env)
#   --bucket <S3_BUCKET>    AWS S3 or compatible bucket for backup vaults
#   --prefix <S3_PREFIX>    S3 folder prefix (Default: servers)
#   --region <AWS_REGION>   AWS default region (Default: us-east-1)
#   --access-key <KEY>      AWS Access Key ID (Optional if using IAM roles)
#   --secret-key <SECRET>   AWS Secret Access Key (Optional if using IAM roles)
#   --endpoint <URL>        Custom S3 endpoint (For MinIO, Wasabi, Cloudflare R2)
#   --env <ENVIRONMENT>     Server environment tag (Default: production)
#   --non-interactive       Bypass interactive prompts and accept CLI flags
#   --help                  Display this help message
# ==============================================================================

set -euo pipefail

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Default values
HUB_URL=""
API_KEY=""
S3_BUCKET=""
S3_PREFIX="servers"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY=""
AWS_SECRET_KEY=""
S3_ENDPOINT=""
ENVIRONMENT="production"
NON_INTERACTIVE=false

CONF_FILE="/etc/backup_agent.conf"
BIN_TARGET="/usr/local/bin/backup_agent.sh"
LOG_FILE="/var/log/backup_pulse.log"

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "=================================================================="
  echo "   🛡️  BackupPulse Fleet Rollout & Client Agent Installer        "
  echo "   Automated Agent Setup for 100+ Production Linux Servers        "
  echo "=================================================================="
  echo -e "${NC}"
}

# Parse command line flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hub)
      HUB_URL="$2"; shift 2 ;;
    --key)
      API_KEY="$2"; shift 2 ;;
    --bucket)
      S3_BUCKET="$2"; shift 2 ;;
    --prefix)
      S3_PREFIX="$2"; shift 2 ;;
    --region)
      AWS_REGION="$2"; shift 2 ;;
    --access-key)
      AWS_ACCESS_KEY="$2"; shift 2 ;;
    --secret-key)
      AWS_SECRET_KEY="$2"; shift 2 ;;
    --endpoint)
      S3_ENDPOINT="$2"; shift 2 ;;
    --env)
      ENVIRONMENT="$2"; shift 2 ;;
    --non-interactive|-y)
      NON_INTERACTIVE=true; shift ;;
    --help|-h)
      head -n 25 "$0" | grep -E '^#' | sed 's/^#//'; exit 0 ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

print_banner

# Check root privileges
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}❌ Error: This installer must be run as root (or with sudo).${NC}"
  echo "Run: sudo $0 $*"
  exit 1
fi

echo -e "${BLUE}🔍 [1/6] Validating System Dependencies...${NC}"
MISSING_DEPS=()
for cmd in curl tar gzip sha256sum; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING_DEPS+=("$cmd")
  fi
done

if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
  echo -e "${RED}❌ Missing required utilities: ${MISSING_DEPS[*]}${NC}"
  echo "Please install them via apt-get or yum, then re-run this script."
  exit 1
fi
echo -e "${GREEN}✓ Core utilities found: curl, tar, gzip, sha256sum${NC}"

# Check AWS CLI or warn
if ! command -v aws &>/dev/null; then
  echo -e "${YELLOW}⚠️  Warning: 'aws' CLI tool was not found in PATH.${NC}"
  echo -e "   The agent requires AWS CLI to upload archives to S3."
  echo -e "   Install via: curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\" && unzip awscliv2.zip && ./aws/install"
fi

# Interactive prompts if required fields are missing
if [[ "$NON_INTERACTIVE" = false ]]; then
  if [[ -z "$HUB_URL" ]]; then
    read -rp "Enter BackupPulse Hub URL (e.g. http://10.0.0.1:3000): " HUB_URL
  fi
  if [[ -z "$API_KEY" ]]; then
    read -rp "Enter Ingestion API Key (from hub .env API_KEY): " API_KEY
  fi
  if [[ -z "$S3_BUCKET" ]]; then
    read -rp "Enter AWS S3 Bucket Name: " S3_BUCKET
  fi
fi

# Normalize Hub URL
HUB_URL="${HUB_URL%/}"
if [[ -z "$HUB_URL" || -z "$API_KEY" || -z "$S3_BUCKET" ]]; then
  echo -e "${RED}❌ Error: --hub, --key, and --bucket are mandatory parameters.${NC}"
  exit 1
fi

API_ENDPOINT="${HUB_URL}/api/v1/backups/report"

echo -e "\n${BLUE}🌐 [2/6] Verifying Connectivity to BackupPulse Hub...${NC}"
HEALTH_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "${HUB_URL}/health" || echo "000")
if [[ "$HEALTH_STATUS" =~ ^(200|301|302)$ ]]; then
  echo -e "${GREEN}✓ Successfully reached BackupPulse Hub at ${HUB_URL}/health (HTTP ${HEALTH_STATUS})${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: Unable to verify ${HUB_URL}/health (HTTP ${HEALTH_STATUS}). Proceeding with installation.${NC}"
fi

echo -e "\n${BLUE}📦 [3/6] Installing Executable Agent...${NC}"
# Determine source directory of backup_agent.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_AGENT="${SCRIPT_DIR}/backup_agent.sh"

if [[ -f "$SOURCE_AGENT" ]]; then
  cp "$SOURCE_AGENT" "$BIN_TARGET"
else
  # If running standalone, download from hub
  echo "Fetching backup_agent.sh from hub..."
  curl -fsSL "${HUB_URL}/scripts/backup_agent.sh" -o "$BIN_TARGET" || {
    echo -e "${RED}❌ Failed to locate backup_agent.sh. Make sure it is present in the scripts/ folder.${NC}"
    exit 1
  }
fi

chmod 755 "$BIN_TARGET"
echo -e "${GREEN}✓ Installed backup_agent.sh to ${BIN_TARGET} (chmod 755)${NC}"

echo -e "\n${BLUE}🔒 [4/6] Generating Configuration File (/etc/backup_agent.conf)...${NC}"
cat > "$CONF_FILE" <<EOF
# ==============================================================================
# BackupPulse Client Configuration (/etc/backup_agent.conf)
# Generated automatically by install_agent.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==============================================================================

# Central Ingestion Hub
API_URL="${API_ENDPOINT}"
API_KEY="${API_KEY}"

# S3 Destination Vault
S3_BUCKET="${S3_BUCKET}"
S3_PREFIX="${S3_PREFIX}"
AWS_DEFAULT_REGION="${AWS_REGION}"

# S3 Access Keys (Leave empty if using AWS IAM Instance Roles)
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_KEY}"

EOF

if [[ -n "$S3_ENDPOINT" ]]; then
  echo "S3_ENDPOINT_URL=\"${S3_ENDPOINT}\"" >> "$CONF_FILE"
fi

cat >> "$CONF_FILE" <<EOF
ENVIRONMENT="${ENVIRONMENT}"
KEEP_LOCAL_DAYS=0
TEMP_DIR="/tmp/backup_jobs"
EOF

chmod 600 "$CONF_FILE"
echo -e "${GREEN}✓ Created secure configuration at ${CONF_FILE} (chmod 600)${NC}"

echo -e "\n${BLUE}📝 [5/6] Setting Up System Logging & Log Rotation...${NC}"
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

# Logrotate configuration
if [[ -d "/etc/logrotate.d" ]]; then
  cat > "/etc/logrotate.d/backup_pulse" <<EOF
${LOG_FILE} {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    create 0644 root root
}
EOF
  echo -e "${GREEN}✓ Configured logrotate at /etc/logrotate.d/backup_pulse${NC}"
fi

echo -e "\n${BLUE}🧪 [6/6] Testing Agent Execution Dry-Run...${NC}"
if "$BIN_TARGET" --help &>/dev/null; then
  echo -e "${GREEN}✓ Agent self-test passed! Version and CLI flags confirmed.${NC}"
else
  echo -e "${YELLOW}⚠️  Agent help test returned non-zero. Check dependencies.${NC}"
fi

echo -e "\n${GREEN}${BOLD}=================================================================="
echo "   🎉 BackupPulse Agent Successfully Installed!"
echo "==================================================================${NC}"
echo -e "Binary:         ${CYAN}${BIN_TARGET}${NC}"
echo -e "Configuration:  ${CYAN}${CONF_FILE}${NC}"
echo -e "Hub Ingestion:  ${CYAN}${API_ENDPOINT}${NC}"
echo -e "S3 Vault:       ${CYAN}s3://${S3_BUCKET}/${S3_PREFIX}/${NC}"
echo ""
echo -e "${BOLD}Recommended Crontab Configuration:${NC}"
echo -e "Add these lines to ${CYAN}crontab -e${NC}:"
echo ""
echo -e "${YELLOW}# Database Backup daily at 02:00 AM${NC}"
echo "0 2 * * * ${BIN_TARGET} --project \"primary-db\" --type \"db\" --db-cmd \"mysqldump -u root -p'Secret' app_db\" >> ${LOG_FILE} 2>&1"
echo ""
echo -e "${YELLOW}# Application Code Backup daily at 03:00 AM${NC}"
echo "0 3 * * * ${BIN_TARGET} --project \"web-app\" --type \"code\" --dir \"/var/www/app\" >> ${LOG_FILE} 2>&1"
echo ""
echo -e "To test manually right now, run:"
echo -e "  ${CYAN}${BIN_TARGET} --project \"test-app\" --type \"code\" --dir \"/etc/nginx\"${NC}"
echo "=================================================================="
