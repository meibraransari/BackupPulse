#!/usr/bin/env bash
set -e

# ==============================================================================
# BackupPulse Docker Container Entrypoint
# ==============================================================================

# ANSI Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____             _                ____        _          
 | __ )  __ _  ___| | ___   _ _ __ |  _ \ _   _| |___  ___ 
 |  _ \ / _` |/ __| |/ / | | | '_ \| |_) | | | | / __|/ _ \
 | |_) | (_| | (__|   <| |_| | |_) |  __/| |_| | \__ \  __/
 |____/ \__,_|\___|_|\_\\__,_| .__/|_|    \__,_|_|___/\___|
                             |_|                           
EOF
echo -e "${NC}"

echo -e "${BLUE}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD} 🛡️  BackupPulse — Centralized Backup Telemetry & Monitoring System${NC}"
echo -e "${BLUE}${BOLD}======================================================================${NC}"
echo -e " 🚀 ${BOLD}Repository:${NC}     https://github.com/meibraransari/BackupPulse.git"
echo -e " 👨‍💻 ${BOLD}Developed By:${NC}   Ibrar Ansari (me.ibraransari@gmail.com)"
echo -e " 📜 ${BOLD}License:${NC}        MIT (Free & Open Source for Everyone)"
echo -e " 📦 ${BOLD}Version:${NC}        1.0.0 (Production Release)"
echo -e "${BLUE}${BOLD}----------------------------------------------------------------------${NC}"
echo -e " 🌐 ${BOLD}Environment:${NC}    ${NODE_ENV:-production}"
echo -e " 🚪 ${BOLD}Listening Port:${NC} ${PORT:-3000}"
echo -e " 📡 ${BOLD}Base URL:${NC}       ${APP_BASE_URL:-http://localhost:3000}"
echo -e " 💬 ${BOLD}Google Chat:${NC}    ${ENABLE_GOOGLE_CHAT:-false}"
echo -e " ✉️  ${BOLD}Email Alerts:${NC}   ${ENABLE_SMTP:-false} (Provider: ${EMAIL_PROVIDER:-smtp})"
echo -e " 📖 ${BOLD}Swagger Docs:${NC}   ${ENABLE_SWAGGER:-true}"
echo -e " 🧹 ${BOLD}Housekeeping:${NC}   ${ENABLE_HOUSEKEEPING:-true} (Retention: ${DB_RETENTION_DAYS:-365} days)"
echo -e "${BLUE}${BOLD}======================================================================${NC}"
echo ""

# Run database migrations before starting the service
echo -e "${YELLOW}🔄 Applying database migrations with Prisma migrate deploy...${NC}"
if npx prisma migrate deploy; then
  echo -e "${GREEN}✅ Database migrations deployed successfully.${NC}"
elif npx prisma db push --skip-generate; then
  echo -e "${GREEN}✅ Database schema synchronized via db push fallback.${NC}"
else
  echo -e "${YELLOW}⚠️  Database migration exited with warning. Proceeding with application startup...${NC}"
fi

echo ""
echo -e "${GREEN}🚀 Starting BackupPulse application...${NC}"
echo ""

# Execute CMD arguments or default to node dist/index.js
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node dist/index.js
fi
