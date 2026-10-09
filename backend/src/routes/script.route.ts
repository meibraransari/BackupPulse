import { FastifyInstance } from 'fastify';
import { config } from '../config/env';

export async function scriptRoutes(fastify: FastifyInstance) {
  /**
   * 1-Line Pre-Flight Environment Diagnostic Script Generator
   * Usage:
   *   curl -fsSL "https://hub.example.com/api/v1/scripts/preflight?type=postgres&dest=s3" | bash
   */
  fastify.get(
    '/api/v1/scripts/preflight',
    {
      schema: {
        description: 'Generate dynamic POSIX/Bash pre-flight environment diagnostic script',
        tags: ['Client Scripts'],
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['postgres', 'mysql', 'directory', 'curl', 'custom', 'generic'], default: 'postgres' },
            dest: { type: 'string', enum: ['s3', 'gcs', 'azure', 'local', 'mapped', 'none'], default: 's3' },
            hubUrl: { type: 'string' },
            drill: { type: 'string', enum: ['true', 'false'], default: 'false' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const backupType = (query.type || 'postgres').toLowerCase();
      const storageDest = (query.dest || 's3').toLowerCase();
      const hubUrl = (query.hubUrl || config.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const testDrill = query.drill === 'true';

      const scriptContent = `#!/usr/bin/env bash
# ==============================================================================
#  🛡️  BackupPulse — Automated Pre-Flight Environment Diagnostic Checker
# ==============================================================================
#  Target Engine:   ${backupType.toUpperCase()}
#  Storage Target:  ${storageDest.toUpperCase()}
#  BackupPulse Hub: ${hubUrl}
#  Timestamp:       $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==============================================================================

set -o pipefail

# ANSI Color Palette
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
BOLD='\\033[1m'
NC='\\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

print_pass() {
  echo -e "  \${GREEN}✅ [PASS]\${NC} \$1"
  ((PASS_COUNT++))
}

print_warn() {
  echo -e "  \${YELLOW}⚠️  [WARN]\${NC} \$1"
  ((WARN_COUNT++))
}

print_fail() {
  echo -e "  \${RED}❌ [FAIL]\${NC} \$1"
  ((FAIL_COUNT++))
}

print_info() {
  echo -e "  \${CYAN}ℹ️  [INFO]\${NC} \$1"
}

echo ""
echo -e "\${BOLD}==================================================================\${NC}"
echo -e "\${BOLD} 🩺 BackupPulse — Pre-Flight Diagnostic Health Checker\${NC}"
echo -e "\${BOLD}==================================================================\${NC}"
echo -e " Target Engine:  \${CYAN}${backupType.toUpperCase()}\${NC}"
echo -e " Target Storage: \${CYAN}${storageDest.toUpperCase()}\${NC}"
echo -e " Hub Endpoint:   \${CYAN}${hubUrl}\${NC}"
echo -e " Hostname:       \${CYAN}$(hostname)\${NC}"
echo -e " Date / UTC:     \${CYAN}$(date -u)\${NC}"
echo -e "\${BOLD}==================================================================\${NC}"
echo ""

# ------------------------------------------------------------------------------
# [1/5] Core POSIX & System Utilities
# ------------------------------------------------------------------------------
echo -e "\${BOLD}📦 [1/5] Verifying Core System Utilities...\${NC}"

for cmd in curl gzip awk date sha256sum; do
  if command -v "\$cmd" >/dev/null 2>&1; then
    print_pass "Utility '\$cmd' is installed (\$(command -v \$cmd))."
  else
    print_fail "Core utility '\$cmd' is missing. Please install it via apt/yum."
  fi
done

if command -v zip >/dev/null 2>&1; then
  print_pass "Archive utility 'zip' is installed."
else
  print_warn "'zip' utility is recommended for database dumps (sudo apt-get install zip)."
fi

# ------------------------------------------------------------------------------
# [2/5] Database / Engine Specific Tools
# ------------------------------------------------------------------------------
echo ""
echo -e "\${BOLD}🗄️  [2/5] Checking Database & Engine Tools (${backupType.toUpperCase()})...\${NC}"

case "${backupType}" in
  postgres)
    if command -v pg_dump >/dev/null 2>&1; then
      PG_VER=$(pg_dump --version 2>&1 | head -n 1)
      print_pass "PostgreSQL dump tool 'pg_dump' found: \$PG_VER"
    else
      print_fail "'pg_dump' is missing! Install via: sudo apt-get install postgresql-client"
    fi

    if command -v psql >/dev/null 2>&1; then
      print_pass "'psql' client utility is installed."
    else
      print_warn "'psql' client not found (optional, but helpful for healthchecks)."
    fi
    ;;
  mysql)
    if command -v mysqldump >/dev/null 2>&1; then
      MY_VER=$(mysqldump --version 2>&1 | head -n 1)
      print_pass "MySQL dump tool 'mysqldump' found: \$MY_VER"
    else
      print_fail "'mysqldump' is missing! Install via: sudo apt-get install mysql-client"
    fi

    if command -v mysqladmin >/dev/null 2>&1; then
      print_pass "'mysqladmin' client utility is installed."
    else
      print_warn "'mysqladmin' not found (optional)."
    fi
    ;;
  directory)
    if command -v zip >/dev/null 2>&1; then
      print_pass "Compression utility 'zip' is available."
    else
      print_fail "'zip' is missing for directory archiving! Install via: sudo apt-get install zip"
    fi
    ;;
  curl|custom|generic|*)
    if command -v curl >/dev/null 2>&1; then
      CURL_VER=$(curl --version 2>&1 | head -n 1)
      print_pass "cURL HTTP client is installed: $CURL_VER"
    else
      print_fail "'curl' is missing! Install via: sudo apt-get install curl"
    fi
    print_info "Generic cURL telemetry mode active. No database client required."
    ;;
esac

# ------------------------------------------------------------------------------
# [3/5] Target Storage Destination Tools
# ------------------------------------------------------------------------------
echo ""
echo -e "\${BOLD}☁️  [3/5] Verifying Target Storage Destination (${storageDest.toUpperCase()})...\${NC}"

case "${storageDest}" in
  s3)
    if command -v aws >/dev/null 2>&1; then
      AWS_VER=$(aws --version 2>&1 | head -n 1)
      print_pass "AWS CLI is installed: \$AWS_VER"
      # Test authentication
      if aws sts get-caller-identity >/dev/null 2>&1; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text 2>/dev/null)
        print_pass "AWS credentials verified (Active AWS Account: \$ACCOUNT_ID)."
      else
        print_warn "AWS CLI installed, but AWS credentials not configured (Run 'aws configure' or set AWS_ACCESS_KEY_ID)."
      fi
    else
      print_fail "AWS CLI is not installed! Install via: 'sudo apt install awscli' or 'curl https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip'"
    fi
    ;;
  gcs)
    if command -v gsutil >/dev/null 2>&1 || command -v gcloud >/dev/null 2>&1; then
      print_pass "Google Cloud Storage CLI (gsutil/gcloud) is installed."
    else
      print_fail "GCS tool 'gsutil' or 'gcloud' is not installed! Install Google Cloud SDK."
    fi
    ;;
  azure)
    if command -v az >/dev/null 2>&1 || command -v azcopy >/dev/null 2>&1; then
      print_pass "Azure storage tool (az/azcopy) is installed."
    else
      print_fail "Azure CLI 'az' or 'azcopy' is not installed! Install Azure CLI."
    fi
    ;;
  local|mapped)
    print_pass "Local / mapped file storage selected. No external cloud CLI required."
    ;;
esac

# ------------------------------------------------------------------------------
# [4/5] Network Egress & BackupPulse Central Hub Reachability
# ------------------------------------------------------------------------------
echo ""
echo -e "\${BOLD}📡 [4/5] Testing Network Egress to BackupPulse Central Hub...\${NC}"
print_info "Attempting HTTP ping to: ${hubUrl}/health"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 --max-time 12 "${hubUrl}/health" 2>/dev/null || echo "TIMEOUT")

if [[ "\$HTTP_CODE" == "200" ]]; then
  print_pass "Network egress verified! BackupPulse Hub responded with HTTP 200 OK."
elif [[ "\$HTTP_CODE" =~ ^[23] ]]; then
  print_pass "Network egress verified! Hub reachable (HTTP \$HTTP_CODE)."
elif [[ "\$HTTP_CODE" == "TIMEOUT" || "\$HTTP_CODE" == "000" ]]; then
  print_fail "Connection timeout to ${hubUrl}! Please check firewall egress rules and security groups."
else
  print_warn "Hub returned HTTP \$HTTP_CODE. Connectivity established, but endpoint returned non-200 status."
fi

# ------------------------------------------------------------------------------
# [5/5] Local Disk Space & Sandbox Readiness
# ------------------------------------------------------------------------------
echo ""
echo -e "\${BOLD}💾 [5/5] Checking Local Storage & DR Readiness...\${NC}"

AVAIL_DISK=$(df -h . 2>/dev/null | awk 'NR==2 {print $4}' || echo "Unknown")
print_info "Available disk space in current directory: \${AVAIL_DISK}"

${testDrill ? `
# Restoration Drill (DrillPulse) Check
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    print_pass "Docker daemon is running. Ephemeral restore sandbox (DrillPulse) supported!"
  else
    print_warn "Docker installed, but current user lacks socket permission. Run: 'sudo usermod -aG docker \$USER'"
  fi
else
  print_warn "Docker is not installed. Ephemeral restoration sandbox requires Docker."
fi
` : ''}

# ------------------------------------------------------------------------------
# Diagnostic Summary
# ------------------------------------------------------------------------------
echo ""
echo -e "\${BOLD}==================================================================\${NC}"
echo -e "\${BOLD} 📊 Pre-Flight Diagnostic Summary\${NC}"
echo -e "\${BOLD}==================================================================\${NC}"
echo -e " Total Passed:  \${GREEN}\${PASS_COUNT}\${NC}"
echo -e " Total Warnings: \${YELLOW}\${WARN_COUNT}\${NC}"
echo -e " Total Failed:   \${RED}\${FAIL_COUNT}\${NC}"
echo -e "\${BOLD}==================================================================\${NC}"

if [[ \$FAIL_COUNT -eq 0 ]]; then
  echo -e "\${GREEN}\${BOLD}🎉 PRE-FLIGHT CHECK PASSED!\${NC}"
  echo -e "This system is 100% prepared for BackupPulse automated backups."
  echo ""
  exit 0
else
  echo -e "\${RED}\${BOLD}⚠️  PRE-FLIGHT CHECK FAILED!\${NC}"
  echo -e "Please address the \${FAIL_COUNT} failed check(s) above before scheduling your cron backup."
  echo ""
  exit 1
fi
`;

      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return reply.send(scriptContent);
    }
  );
}
