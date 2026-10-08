# 🛡️ BackupPulse — Centralized Backup Telemetry & Monitoring System

A high-performance Node.js & React telemetry platform designed to monitor automated backup cron jobs across **100+ production servers**, store logs and metadata in **PostgreSQL**, generate interactive analytics, and dispatch daily health reports to **Google Chat**.

---

## 🌟 Architecture & Features

```
[100+ Production Servers] (Cron Jobs)
       │
       ▼
 [backup_agent.sh] ───► Compresses directory & DB dump
       │           ───► Uploads archive to AWS S3
       │           ───► Calculates checksum & duration
       │
       ▼ (HTTP POST with x-api-key)
[BackupPulse Backend] (Fastify + TypeScript)
       │
       ├──► Live Swagger UI: /api/docs
       ├──► Prometheus Metrics Endpoint: /metrics
       ├──► Health Check: /health
       ├──► Rate-Limiting Guard: @fastify/rate-limit (Brute-force & Cron spam protection)
       ├──► Scoped Token Validator: Master API Key or Per-Server/Per-Project Scoped Tokens
       ├──► Stores Telemetry in PostgreSQL (Versioned Prisma Migrations)
       ├──► Real-Time Instant Failure Alert Dispatcher (INSTANT_ALERT_ON_FAILURE)
       └──► Automated Scheduled Reporter (Cron: REPORT_CRON)
              │
              ├──► Channel 1: [Google Chat Webhook (Cards v2)]
              ├──► Channel 2: [SMTP / SendGrid / AWS SES Email (Responsive Dark HTML)]
              ├──► Channel 3: [Slack Webhook (Block Kit with Color Sidebars)]
              ├──► Channel 4: [Discord Webhook (Rich Embeds with Fields)]
              └──► Channel 5: [Telegram Bot (Formatted HTML Alerts)]
       │
       ▼
[BackupPulse Dashboard] (React + Vite + Tailwind CSS)
       ├──► 🧭 Enterprise Dark Sidebar (Workspaces, Instant Actions, Profile, API Link)
       ├──► 🌐 Timezone Display Switcher (Persistent 1-Click Toggle: UTC vs Local Browser Time)
       ├──► 🔑 Per-Server & Per-Project API Tokens Modal (1-Click Revocation & Copy Secret)
       ├──► Summary KPI Cards (Total Backups, Success Rate, Failed count, Storage)
       ├──► Historical Trends (Clickable 7-30 Days Success vs Failure Charts)
       ├──► 🖥️ Server Fleet Inventory Matrix (100+ Servers Health, Storage, Staleness)
       ├──► ⏱️ Dead Man’s Snitch Engine (Silent Server Detection >26h & Host Mute Controls)
       ├──► 📉 Backup Size Anomaly Detection (Zero-Byte & Truncation Guard Badges)
       ├──► 👥 Multi-User Directory (Admin, Operator, Viewer roles & Profile Management)
       ├──► 🔒 Live User Login Tracker (IP, User-Agent, Success/Failure Audits)
       ├──► 📊 Notification Delivery Audit UI (Multi-Channel History + Payload Inspector)
       ├──► 🧹 Database Storage & Housekeeping Modal (Retention Controls & Force Purge)
       ├──► Advanced Multi-Filter & Resizable Columns (Project, Host, Status, Date)
       ├──► Detail Drawer & Professional Incident Resolution Modal
       └──► Instant Test Actions (Test Google Chat, Email, Slack, Discord, Telegram, Export CSV/JSON)
```

---

## 🚀 Quick Start with Docker Compose

### 1. Clone the Repository
```bash
git clone --depth 1 https://github.com/meibraransari/BackupPulse.git
cd BackupPulse
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

### 3. Launch the Application
Run Docker Compose to build and start the PostgreSQL database and the unified application container:
```bash
docker compose up -d --build

# View container startup logs & runtime banner
docker compose logs -f app
```

### 4. Access the Services
* **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
  * Default Username: `admin`
  * Default Password: `Admin@123456`
* **Swagger OpenAPI Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Toggle with `ENABLE_SWAGGER=false` in production)
* **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🔔 Multi-Channel Alert Engine & Instant Failure Dispatch

BackupPulse includes an enterprise multi-channel notification and alert dispatcher. Alerts can be dispatched **immediately upon failure** (`INSTANT_ALERT_ON_FAILURE=true`) and/or as a **consolidated daily health report** (`REPORT_CRON`).

### Supported Channels Matrix

| Channel | Protocol | Message Format | Instant Alerts | Daily Digest |
| :--- | :--- | :--- | :---: | :---: |
| **Google Chat** | Webhook | Cards v2 with dynamic color badges & deep link buttons | ✅ | ✅ |
| **Email (SMTP/SendGrid/SES)** | SMTP Relay / Web API | Responsive Dark-Mode HTML template | ✅ | ✅ |
| **Slack** | Incoming Webhook | Block Kit with color-coded sidebars & fields | ✅ | ✅ |
| **Discord** | Webhook | Rich Embeds with color status & execution details | ✅ | ✅ |
| **Telegram** | Bot API | Formatted HTML messages with monospace traces | ✅ | ✅ |

### ⚡ Real-Time Instant Failure Dispatch (`INSTANT_ALERT_ON_FAILURE=true`)
When enabled, the exact second any backup reports `status === 'FAILED'` or is flagged with a critical size drop anomaly (`isAnomaly === true`), high-priority alerts are immediately dispatched to **all enabled channels** (Google Chat, Email, Slack, Discord, Telegram) without waiting for the scheduled morning digest.
- **5-Minute Deduplication Cooldown**: Automatically prevents alert spam from rapid or broken cron loops on individual servers while recording every run in the database.

### Notification Settings in `.env`

```ini
# --- Real-Time Instant Alerts ---
INSTANT_ALERT_ON_FAILURE=true

# --- Scheduled Summary Digest Cron (default: 9:00 AM daily) ---
REPORT_CRON="0 9 * * *"

# --- Channel 1: Google Chat ---
ENABLE_GOOGLE_CHAT=true
GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=...&token=..."

# --- Channel 2: Email Reporting (SMTP / SendGrid / AWS SES) ---
ENABLE_SMTP=true
EMAIL_PROVIDER=smtp  # 'smtp' | 'sendgrid' | 'ses'
EMAIL_FROM="BackupPulse Central <alerts@yourdomain.com>"
EMAIL_TO="devops@yourdomain.com,team-lead@yourdomain.com"

# Standard SMTP Relay (e.g. Gmail, Postfix, Office 365)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="alerts@yourdomain.com"
SMTP_PASSWORD="your-app-password"

# SendGrid Web API v3
SENDGRID_API_KEY="SG.your_sendgrid_api_key_here"

# AWS SES (Simple Email Service)
AWS_SES_REGION="us-east-1"
# Optional explicit credentials (omit to use AWS IAM instance profiles / ECS / EKS roles):
AWS_SES_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SES_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# --- Channel 3: Slack (Block Kit) ---
ENABLE_SLACK=true
SLACK_WEBHOOK_URL=

# --- Channel 4: Discord (Rich Embeds) ---
ENABLE_DISCORD=true
DISCORD_WEBHOOK_URL=

# --- Channel 5: Telegram Bot ---
ENABLE_TELEGRAM=true
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_CHAT_ID="-1001234567890"
```

### ✉️ Email Report Features (SMTP / SendGrid / AWS SES)
- **Multi-Provider Support**: Seamlessly route emails through traditional SMTP, high-deliverability SendGrid Web API, or cost-effective AWS SES with automatic IAM role fallback.
- **Responsive Dark-Mode Template**: Optimized for mobile and desktop mail clients with corporate visual hierarchy.
- **Executive KPIs**: Total Backups, 24h Success Rate %, Failed Count, Total Vault Storage.
- **Dedicated Failure Table**: Lists failed jobs with project, server hostname, backup type, and error traces.
- **Dead Man’s Snitch Warning Table**: Alerts team to servers missing expected cron runs (`>26h`).
- **Anomaly Detection Table**: Highlights size truncations and zero-byte archives.
- **One-Click CTA**: Jump directly into the live BackupPulse web dashboard from your inbox.

### 💬 Google Chat Features
- Google Chat **Cards v2** with color badges (green for 100% healthy, red for failures).
- Highlighted crash reasons, hostnames, duration, and archive sizes.
- Interactive deep link button to inspect the incident in BackupPulse.

### 🤖 Slack, Discord & Telegram Features
- **Slack Block Kit**: Clean structured blocks with color status sidebars, key-value grids, and markdown error callouts.
- **Discord Rich Embeds**: Branded embeds with severity colors (green, red, amber), server hostname, size, and error fields.
- **Telegram HTML**: Fast, compact mobile alerts with emoji indicators, project tags, and formatted error snippets.

---

## 💻 Client Shell Script Setup (For 100+ Servers)

### ⚡ Option A: Quick Integration for Existing Backup Scripts (Single `curl`)

If your admin team already has established backup scripts (running `mysqldump`, `pg_dump`, `tar`, `aws s3 cp`) and simply needs to push a single telemetry entry to BackupPulse, use [`scripts/send_backup_telemetry.sh`](scripts/send_backup_telemetry.sh) or add this single `curl` call directly at the end of your existing script:

```bash
# Standalone execution test:
./scripts/send_backup_telemetry.sh "my-database" "db" "SUCCESS" "db_backup.tar.gz"

# Or embed directly in your existing script:
curl -s -X POST "http://your-backuppulse-hub:3000/api/v1/backups/report" \
  -H "Content-Type: application/json" \
  -H "x-api-key: bkp_live_secret_key_12345" \
  -d "{
    \"server_id\": \"$(hostname -s)\",
    \"hostname\": \"$(hostname -f)\",
    \"project_name\": \"ecommerce-db\",
    \"backup_type\": \"db\",
    \"status\": \"SUCCESS\",
    \"start_time\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"end_time\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"zip_filename\": \"ecommerce-db_backup.tar.gz\"
  }"
```

### 🛠️ Option B: Full Automated Backup Agent (`backup_agent.sh`)

Deploy `scripts/backup_agent.sh` to `/usr/local/bin/backup_agent.sh` on your servers for end-to-end compression, S3 upload, and checksum generation.

### 1. Permissions
```bash
chmod +x /usr/local/bin/backup_agent.sh
```

### 2. Configuration (`/etc/backup_agent.conf`)
Create `/etc/backup_agent.conf` on each server:
```bash
# Central Ingestion Hub
API_URL="http://your-backup-hub-ip:3000/api/v1/backups/report"
API_KEY="bkp_live_secret_key_12345"

# S3 Destination Settings
S3_BUCKET="my-company-backup-vault"
S3_PREFIX="servers"
AWS_DEFAULT_REGION="us-east-1"

# S3 Access Key & Secret Key Authentication
# (Leave empty to use AWS IAM Instance Profiles or existing ~/.aws/credentials)
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# Optional Custom S3 Endpoint (for MinIO, Wasabi, Cloudflare R2, DigitalOcean Spaces)
# S3_ENDPOINT_URL="https://s3.wasabisys.com"

ENVIRONMENT="production"
KEEP_LOCAL_DAYS=0
TEMP_DIR="/tmp/backup_jobs"
```

### 3. Crontab Examples (`crontab -e`)

```bash
# Code Backup at 01:00 AM
0 1 * * * /usr/local/bin/backup_agent.sh --project "ecommerce-api" --type "code" --dir "/var/www/ecommerce"

# MySQL Database Backup at 02:00 AM
0 2 * * * /usr/local/bin/backup_agent.sh --project "ecommerce-db" --type "db" --db-cmd "mysqldump -u root -p'Password' ecommerce_prod"

# PostgreSQL Database Backup at 02:30 AM
30 2 * * * /usr/local/bin/backup_agent.sh --project "auth-db" --type "db" --db-cmd "pg_dump -U postgres auth_db"

# Weekly Full Backup (Code + DB) on Sundays at 03:00 AM
0 3 * * 0 /usr/local/bin/backup_agent.sh --project "billing" --type "full" --dir "/var/www/billing" --db-cmd "mysqldump -u root billing_prod"
```

### Script Execution Guarantees:
- **Error Trapping**: If the DB dump, compression, or S3 upload fails, the script catches the exact `stderr` message, marks status as `FAILED`, and sends the alert payload to the central API.
- **Checksums & Sizing**: Automatically records SHA256 checksum and exact byte size.
- **Zero Disk Leakage**: Staging directories and local `.tar.gz` files are deleted after upload.

---

### 🐘 Option C: Dedicated PostgreSQL S3 Backup & Pruning Agent (`postgres_s3_backup.sh`)

For dedicated PostgreSQL database servers dumping to AWS S3 with automatic archive retention pruning (e.g. keep max 30 archives in S3 bucket) and minimum file-size anomaly checking, deploy [`scripts/postgres_s3_backup.sh`](scripts/postgres_s3_backup.sh):

```bash
# 1. Install system tools
sudo apt update && sudo apt install -y postgresql-client zip unzip jq awscli curl

# 2. Make executable
chmod +x scripts/postgres_s3_backup.sh

# 3. Test execution (Dry run simulation)
./scripts/postgres_s3_backup.sh --dry-run --backup-path /tmp/pg_test

# 4. Production Cron Entry (e.g., daily at 23:59)
59 23 * * * /opt/scripts/postgres_s3_backup.sh >> /var/log/postgres_backup.log 2>&1
```

**Key Capabilities:**
- **Automated `pg_dump` & Zip Compression**: Exports PostgreSQL database with custom/compressed format into `.zip`.
- **Threshold Anomaly Detection**: Warns if backup size drops below threshold (`MIN_FILE_SIZE`, default 35KB) and flags `WARNING`/anomaly in BackupPulse.
- **S3 Sync & Historical Pruning**: Synchronizes archives to AWS S3 and automatically prunes oldest archives when total exceeds `MAX_FILES` (default 30).
- **Direct Central API Telemetry**: Completely eliminates external direct webhook dependencies (Google Chat webhooks replaced by central hub API). The BackupPulse server records the run, updates real-time fleet health, triggers alerts, and logs audit events.

---

### 🐬 Option D: Dedicated MySQL / MariaDB S3 Backup & Pruning Agent (`mysql_s3_backup.sh`)

For dedicated MySQL or MariaDB database servers dumping to AWS S3 with non-blocking online snapshots (`--single-transaction`), automatic archive retention pruning (e.g. keep max 30 archives in S3 bucket), and minimum file-size anomaly checking, deploy [`scripts/mysql_s3_backup.sh`](scripts/mysql_s3_backup.sh):

```bash
# 1. Install system tools
# Debian / Ubuntu:
sudo apt update && sudo apt install -y default-mysql-client zip unzip jq awscli curl
# RHEL / CentOS:
sudo yum install -y mysql zip unzip jq awscli curl

# 2. Make executable
chmod +x scripts/mysql_s3_backup.sh

# 3. Test execution (Dry run simulation)
./scripts/mysql_s3_backup.sh --dry-run --backup-path /tmp/mysql_test

# 4. Production Cron Entry (e.g., daily at 02:00 AM)
0 2 * * * /opt/scripts/mysql_s3_backup.sh >> /var/log/mysql_backup.log 2>&1
```

**Key Capabilities:**
- **Online Non-Blocking `mysqldump`**: Uses `--single-transaction --quick --routines --triggers` for consistent InnoDB dumps without table locking.
- **Single DB or All Databases**: Backs up a targeted database (`--db-name`) or entire cluster (`--all-databases`).
- **Threshold Anomaly Detection**: Flags `WARNING` status if backup archive size is smaller than expected threshold (`MIN_FILE_SIZE`, default 35KB).
- **S3 Sync & Automatic Pruning**: Pushes backups to AWS S3 and purges oldest archives when bucket folder count exceeds `MAX_FILES` (default 30).
- **Real-Time Central Telemetry**: Sends execution logs, duration, S3 keys, SHA256 checksums, and exit statuses directly to BackupPulse.

---

### 🗜️ Option E: Dedicated Directory & File Zip to S3 Agent (`zip_s3_backup.sh`)

For application source code directories, uploads, assets, or arbitrary file paths that need automated zip archiving, AWS S3 upload, retention pruning, and BackupPulse telemetry, deploy [`scripts/zip_s3_backup.sh`](scripts/zip_s3_backup.sh):

```bash
# 1. Install system tools
# Debian / Ubuntu:
sudo apt update && sudo apt install -y zip unzip jq awscli curl
# RHEL / CentOS:
sudo yum install -y zip unzip jq awscli curl

# 2. Make executable
chmod +x scripts/zip_s3_backup.sh

# 3. Test execution (Dry run simulation)
./scripts/zip_s3_backup.sh --dry-run --source-path /var/www/html --backup-path /tmp/zip_test

# 4. Production Cron Entry (e.g., daily at 01:00 AM)
0 1 * * * /opt/scripts/zip_s3_backup.sh --source-path "/var/www/html" --project "ecommerce-web" >> /var/log/zip_backup.log 2>&1
```

**Key Capabilities:**
- **Directory & File Archiving**: Automatically zips entire source directory or individual files with exclusions (e.g. `node_modules/*`, `.git/*`, `tmp/*`).
- **Clean Relative Paths**: Packages files relative to the parent directory for clean extraction.
- **Anomaly Sizing Check**: Automatically flags size plummet anomalies or zero-byte archives (`< MIN_FILE_SIZE`, default 35KB) as `WARNING` in BackupPulse.
- **S3 Sync & Historical Retention**: Syncs archives to AWS S3 and purges oldest files when total exceeds `MAX_FILES` (default 30).
- **Full Central Telemetry**: Dispatches real-time status, checksums, logs, durations, and S3 keys to the BackupPulse API.

---

## 📡 Backend API Reference

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server uptime & DB connection check (includes `swagger` enabled flag) | None |
| `GET` | `/metrics` | Standard Prometheus metrics exposition (counters, gauges, memory, uptime) | None |
| `GET` | `/api/docs` | Interactive Swagger UI sandbox (enabled when `ENABLE_SWAGGER=true`) | None |
| `POST` | `/api/v1/backups/report` | Telemetry ingestion from shell script (rate limit: 120/min, scoped/master key) | `x-api-key` |
| `POST` | `/api/v1/auth/login` | Admin/Operator/Viewer authentication (rate limit: 10/min) | None |
| `GET` | `/api/v1/auth/me` | Current session user profile & permissions | Bearer JWT |
| `GET` | `/api/v1/dashboard/stats` | 24h & all-time summary KPIs | Bearer JWT |
| `GET` | `/api/v1/dashboard/trends` | Daily trends for charts (last 7-30 days) | Bearer JWT |
| `GET` | `/api/v1/dashboard/fleet` | Aggregated 100+ servers fleet health, storage, and staleness matrix | Bearer JWT |
| `GET` | `/api/v1/backups` | Filtered & paginated backup records (supports `isAnomaly` and `availability`: `ALL` / `ACTIVE` / `EXPIRED`) | Bearer JWT |
| `GET` | `/api/v1/backups/:id` | Full details, logs, S3 paths, retention days, and availability status | Bearer JWT |
| `PATCH` | `/api/v1/backups/:id/status` | Manually mark failed backup as SUCCESS with resolution notes | Bearer JWT |
| `GET` | `/api/v1/backups/export` | Export filtered records to CSV or JSON (includes retention days & availability status) | Bearer JWT |
| `GET` | `/api/v1/notifications/status` | Active status of Google Chat, Email, Slack, Discord, Telegram channels | Bearer JWT |
| `GET` | `/api/v1/notifications/logs` | Query alert send audit logs (channel, recipient, status, payload) | Bearer JWT |
| `POST` | `/api/v1/notifications/test-gchat` | Immediate Google Chat webhook test card | Bearer JWT |
| `POST` | `/api/v1/notifications/test-email` | Immediate test email delivery (via active provider: SMTP, SendGrid, or AWS SES) | Bearer JWT |
| `POST` | `/api/v1/notifications/test-smtp` | Test email delivery alias (backward compatibility) | Bearer JWT |
| `POST` | `/api/v1/notifications/test-slack` | Immediate Slack Block Kit test message | Bearer JWT |
| `POST` | `/api/v1/notifications/test-discord` | Immediate Discord Rich Embed test message | Bearer JWT |
| `POST` | `/api/v1/notifications/test-telegram` | Immediate Telegram Bot test alert | Bearer JWT |
| `POST` | `/api/v1/notifications/trigger-daily-report` | Manually dispatch the daily summary report to all enabled channels | Bearer JWT |
| `GET` | `/api/v1/api-keys` | List all provisioned per-server and per-project API tokens | Bearer JWT (Admin) |
| `POST` | `/api/v1/api-keys` | Provision a new scoped API key (`bkp_<hash>`) with optional expiration & constraints | Bearer JWT (Admin) |
| `DELETE` | `/api/v1/api-keys/:id` | Immediately revoke an API key token | Bearer JWT (Admin) |
| `GET` | `/api/v1/system/housekeeping` | Check database retention policy, counts & purge status | Bearer JWT |
| `POST` | `/api/v1/system/cleanup` | Manually trigger database purge of records older than retention threshold | Bearer JWT |
| `GET` | `/api/v1/servers/configs` | Retrieve fleet monitoring configs & mute statuses | Bearer JWT |
| `PATCH` | `/api/v1/servers/:serverId/monitor` | Toggle server monitoring (Mute / Unmute with custom reason) | Bearer JWT |
| `GET` | `/api/v1/auth/logins` | Query paginated authentication login audit tracker | Bearer JWT |
| `PUT` | `/api/v1/auth/profile` | Self-service user profile update (Name, Email, Avatar, Password) | Bearer JWT |
| `GET` | `/api/v1/users` | List all system users with role and active status | Bearer JWT (Admin) |
| `POST` | `/api/v1/users` | Provision a new team user (Username, Password, Role, Email) | Bearer JWT (Admin) |
| `PUT` | `/api/v1/users/:id` | Update user details, role, active status, or reset password | Bearer JWT (Admin) |
| `DELETE` | `/api/v1/users/:id` | Delete user account (Admin account protected) | Bearer JWT (Admin) |

---

## 🗄️ S3 Backup Availability & Retention Lifecycle (`Active,expired`)

In distributed infrastructures, each server typically runs its own automated pruning logic (e.g. retaining the last 30 daily backups and deleting older archives from AWS S3). Previously, telemetry records only indicated whether a backup succeeded at execution time, with no clue whether the file remained available in the bucket or had since been deleted.

BackupPulse introduces automatic **Retention Lifecycle & Availability Tracking**:

- **Retention Policy Ingestion**: Shell scripts pass their retention window in days (`retention_days`, e.g., `--retention-days 30`).
- **Real-Time Expiration Calculation**: The backend calculates the exact expiration date (`expires_at = start_time + retention_days * 86,400,000`). If `now > expires_at`, the archive is categorized as `EXPIRED`; otherwise, it is `ACTIVE`. Failed backups (`FAILED`) are categorized as `N/A`.
- **New Data Table Column (`Active,expired`)**: Positioned immediately after **Status & Action** in the **Backup Telemetry Records** table:
  - 🟢 **`Active`** (Emerald badge): Archive is actively available in the S3 bucket for restoration. Hovering displays remaining days until expiration.
  - 🔴 **`Expired`** (Red badge): Archive has reached the end of its retention lifecycle and has been pruned/purged from S3.
  - ⚪ **`N/A`** (Slate badge): Backup failed at creation time; no valid file exists in the vault.
- **Dedicated Availability Filter**: Filter bar includes an **Active / Expired** dropdown (`All Availability`, `Active (In S3)`, `Expired (Pruned)`) allowing DevOps teams to instantly locate only currently-restorable archives or audit pruned backups.
- **Inspector Modal & S3 Vault Tab**: Full visibility into retention policy duration, exact expiration timestamp, days remaining, or days elapsed since expiration.

---

## 🖥️ Server Fleet Inventory View (100+ Servers At-A-Glance)

Managing backups across hundreds of servers is effortless with the built-in **Fleet Inventory Matrix**:
- **Consolidated Health Status**: Dynamically categorizes each server into `HEALTHY` (all backups passed), `FAILED` (active backup failure), `WARNING` (size anomaly or warning), or `STALE` (missed cron run: `>26 hours` without telemetry).
- **Dual Display Modes**: Switch between **Responsive Card Grid** and a **Dense Matrix Table** designed for rapidly auditing 100+ servers on high-resolution screens.
- **Drill-Down Telemetry Filtering**: One click on "Inspect Server Telemetry" jumps to the primary telemetry table filtered specifically for that machine.
- **Live Search & Status Filtering**: Instant client-side and server-side filtering by Server ID, Hostname, IP address, and hosted project names.

---

## 📉 Backup Size Anomaly Detection (Zero-Byte & Truncation Guard)

Silent backup failures (e.g. database dump tool exiting cleanly with 0 bytes due to a bad argument, or disk exhaustion truncating an archive by 90%) are notoriously difficult to catch:
- **Zero-Byte & Empty Archive Guard**: If a backup reports `SUCCESS` but has an archive size `<= 512 bytes`, BackupPulse automatically flags it as an **Anomaly**, overrides the status to `WARNING`, and attaches an explanatory reason.
- **Historical Size Drop Analysis**: Compares incoming backup size against recent successful runs (>5MB threshold). If the size drops by **>70%** (i.e. `< 30%` of historical average), it is immediately flagged with `isAnomaly = true` and detailed drop metrics.
- **Visual Badges & Multi-Channel Alerts**: Size anomalies display distinct amber badges (`⚠️ Drop` / `⚠️ Anomaly`) across the Telemetry Table, Drawer Inspector, Daily Google Chat Cards, and SMTP HTML emails.
- **Dedicated Filter**: Quick-toggle button in the filter bar to isolate all size anomalies in seconds.

---

## 📊 Notification Delivery Audit UI

Every dispatch attempt to Google Chat and SMTP is tracked in real-time in the `notification_logs` table:
- **Delivery Receipts**: Audit timestamps, channels, event types (`DAILY_SUMMARY`, `TEST_MESSAGE`, `ALERT`), and recipients (email addresses or webhook URLs).
- **Status Badges**: Visual indicator of `SUCCESS` vs `FAILED` dispatches with full error messages on failure (e.g. SMTP connection timeout or invalid webhook credentials).
- **Interactive Payload Viewer**: Inspect the exact JSON card structure or email metadata sent to recipients, with a one-click copy button.

---

## 🧹 Database Retention & Automated Housekeeping

To prevent unbounded database disk usage across hundreds of production servers generating daily backups, BackupPulse features an automated data retention housekeeping policy configurable via `.env`:

```ini
# Maximum days to retain telemetry and alert send logs (default: 365 days / 1 year)
DB_RETENTION_DAYS=365

# Enable or disable automated cron retention purge
ENABLE_HOUSEKEEPING=true

# Schedule for running database cleanup (default: 03:00 AM daily)
HOUSEKEEPING_CRON="0 3 * * *"
```

### How Housekeeping Works:
* **Automated Cron**: Runs daily at 03:00 AM (or your custom `HOUSEKEEPING_CRON`) to purge all records in `backup_reports` and `notification_logs` where `created_at < now - DB_RETENTION_DAYS`.
* **Dashboard Storage Control**: Dedicated modal in the navbar displaying total database rows, eligible purge counts, and cutoff date, with an on-demand "Run Cleanup Now" trigger.
* **Alert Delivery Audit Trail**: Every notification attempt (Google Chat webhook or SMTP email, successful or failed) is stored in the `notification_logs` table with delivery status and payloads, and safely pruned when exceeding the retention window.
* **On-Demand API**: Administrators can check retention metrics via `GET /api/v1/system/housekeeping` or trigger an immediate manual purge via `POST /api/v1/system/cleanup` (with optional custom `days` parameter).
* **Initial DB Schema Load**: Integrated with `prisma/schema.prisma` and `prisma db push`, ensuring fresh Docker or Kubernetes deployments create the tables automatically without manual migration steps.

---

## 🚀 Fleet Rollout Automation (`scripts/install_agent.sh`)

Deploying the backup agent to 100+ bare-metal, EC2, or cloud virtual machines is automated with `scripts/install_agent.sh`. The script performs pre-flight dependency audits, downloads the latest agent binary, sets up `/etc/backup_agent.conf` with secure file permissions (`chmod 600`), and configures automated log rotation.

### Interactive Installation (Wizard Mode)
```bash
sudo bash -c "$(curl -fsSL https://your-backuppulse-hub.com/scripts/install_agent.sh)"
```
The wizard interactively prompts for your central ingestion endpoint, API key, S3 bucket, AWS credentials, and regional settings.

### Silent / Automated Multi-Server Provisioning (Ansible, Puppet, Terraform, Cloud-Init)
```bash
sudo ./scripts/install_agent.sh \
  --hub "https://backup-hub.yourcompany.com/api/v1/backups/report" \
  --key "bkp_live_secret_key_12345" \
  --bucket "my-company-backup-vault" \
  --region "us-east-1" \
  --access-key "AKIAIOSFODNN7EXAMPLE" \
  --secret-key "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" \
  --non-interactive
```

### Installation Guarantees:
- **Dependency Checks**: Automatically checks for `curl`, `tar`, `aws-cli`, `sha256sum`, and `cron`, failing fast with actionable advice if prerequisites are missing.
- **Credential Protection**: `/etc/backup_agent.conf` is written with `chmod 600` and `chown root:root` to prevent non-root users from reading AWS access keys or ingestion API tokens.
- **Log Rotation**: Automatically provisions `/etc/logrotate.d/backup_agent` to rotate cron output logs weekly, compressing archives and preventing disk bloat.

---

## ⏱️ Dead Man’s Snitch / Stale Server Alert & Host Mute Controls

A critical risk in large infrastructure fleets is a server going completely silent (cron daemon died, machine network disconnected, server powered off). BackupPulse includes a **Dead Man’s Snitch** engine that detects missed backups without requiring inbound probes:

- **26-Hour Staleness Threshold**: Any server that has not transmitted a backup report within 26 hours is automatically flagged as `STALE`.
- **Daily Executive Digest Warning**: Stale servers are prominently highlighted in daily Google Chat Cards v2 (`⏱️ Dead Man's Snitch: Missing Backups`) and SMTP HTML emails with hostnames, IP addresses, and hours elapsed since last contact.
- **Host Mute & Exclusion**: When a machine is decommissioned, placed in maintenance, or runs in a development environment, operators can mute it in 1-click via the dashboard or API.
  - **Custom Mute Reasons**: Choose from preset templates (`Decommissioned / Retired`, `Dev / Staging / Non-prod`, `Temporary maintenance window`) or write custom notes.
  - **Zero Alert Fatigue**: Muted servers remain visible in the Server Fleet Inventory (badged as `Muted`), but are excluded from the `STALE` count and omitted from daily alert digests.
  - **1-Click Unmute**: Reactivate monitoring at any time when a server returns to production duty.

---

## 👥 Multi-User Directory, Profile Management & Login Tracker

BackupPulse provides full enterprise identity and role-based access management:

### 1. Multi-User Directory Administration (Admin Console)
- **Role-Based Access Control**:
  - `admin`: Full platform control, user directory administration, server mute toggles, manual resolution, and database housekeeping.
  - `operator`: View all telemetry, manage server mutes, resolve failed backup incidents, and trigger manual reports.
  - `viewer`: Read-only access to telemetry, charts, and fleet inventory.
- **Account Controls**: Add team members, update contact emails, assign roles, toggle account active/disabled status, and reset credentials.

### 2. Self-Service User Profile Management
- Accessible directly from the sidebar footer for all logged-in members.
- Customize **Full Name**, **Contact Email**, and **Avatar Picture** (custom image URL preview or 1-click preset avatar avatars).
- Self-service **Password Change** with current password validation.

### 3. Live Login Audit Tracker
- Every login attempt (successful or rejected) is logged into `user_login_logs` with:
  - Timestamp, Username, Status (`SUCCESS` / `FAILED`)
  - Client IP Address and Browser User-Agent
  - Failure reason (e.g. `Invalid password`, `User account is deactivated`, `User not found`)
- Live audit tab in User Management view with status filters and pagination.
- Console logging: Every authentication event prints formatted audit logs to stdout.
- **Automatic Housekeeping**: Login logs follow the `DB_RETENTION_DAYS` retention policy and are purged automatically during scheduled database cleanups.

---

## 🧭 Persistent Enterprise Sidebar Navigation

The web UI is organized around a persistent, responsive dark sidebar:
- **Workspace Navigation**:
  - `Backup Telemetry Records`: Filterable and resizable data grid with inline incident resolution.
  - `Server Fleet Inventory`: 100+ servers health matrix with grid and table modes, anomaly badges, and host mute toggles.
  - `Users & Access Directory`: Team member management and real-time login audit tracker.
- **Quick-Access Actions**:
  - 💬 **Test Google Chat**: Dispatch live Cards v2 test webhook with delivery feedback.
  - ✉️ **Test SMTP Email**: Send HTML test message to configured recipients.
  - 📊 **Notification Audit Logs**: Review transmission receipts and inspection payloads.
  - 🧹 **Storage & Retention**: Inspect database sizes, configure retention, and trigger immediate housekeeping purge.
  - 📖 **Interactive Swagger UI**: One-click external link to `/api/docs`.
- **Profile & Logout Footer**: User avatar, identity chip, role badge, profile modal trigger, and sign-out button.

---

## 🔑 Per-Server & Per-Project Scoped API Tokens

Previously, all remote servers shared a single central `BACKUP_API_KEY`. In large production environments with 100+ servers, compromising or retiring one machine risked exposing the master key. BackupPulse introduces **granular scoped API tokens**:

- **Scoped Key Generation**: Administrators can generate tokens directly from the dashboard (**DevOps Operations → API Ingestion Tokens**) or via `POST /api/v1/api-keys`.
- **Granular Restrictions**:
  - **Server-Scoped**: Restricts token strictly to a matching `server_id` (e.g. `prod-db-master-01`).
  - **Project-Scoped**: Restricts token strictly to a matching `project_name` (e.g. `billing-postgres`).
  - **Expiration Timers**: Automatically expire keys after a specified number of days (e.g., 90 or 365 days).
- **Security & Hashing**: Keys are generated using cryptographically secure random bytes (`bkp_<hex>`), hashed with SHA-256 before storage in PostgreSQL, and displayed **only once** upon generation with a copy-to-clipboard modal.
- **1-Click Immediate Revocation**: Instantly revoke any compromised token with a single click without affecting other servers.
- **Master Key Backward Compatibility**: The central `BACKUP_API_KEY` defined in `.env` continues to work seamlessly across all existing backup scripts.

---

## 🛡️ API Rate Limiting & Anti-Abuse Protection

To protect the platform against credential brute-forcing and runaway cron spam, BackupPulse implements `@fastify/rate-limit`:

- **Authentication Endpoint (`POST /api/v1/auth/login`)**:
  - **Limit**: Max **10 attempts per minute** per client IP.
  - **Defense**: Thwarts automated dictionary and brute-force attacks against administrative user accounts. Returns HTTP `429 Too Many Requests` when exceeded.
- **Telemetry Ingestion Endpoint (`POST /api/v1/backups/report`)**:
  - **Limit**: Max **120 requests per minute** per client IP.
  - **Defense**: Protects against misconfigured client cron loops (e.g. running every second instead of every hour) from overwhelming the PostgreSQL database.
- **Rate-Limit Headers**: Standard RFC draft headers (`x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`) are returned with every response.

---

## 📈 Prometheus Metrics Telemetry (`/metrics`)

BackupPulse natively exports production-grade Prometheus metrics via `prom-client` on the `/metrics` endpoint for integration into Grafana, Datadog, Prometheus Server, or VictoriaMetrics:

### Available Metric Gauges & Counters

| Metric | Type | Description |
| :--- | :--- | :--- |
| `backuppulse_backup_runs_total` | Counter | Total backup reports ingested, labeled by `status`, `project`, `server_id`, `backup_type` |
| `backuppulse_failures_24h` | Gauge | Total backup failures recorded across the fleet in the rolling last 24 hours |
| `backuppulse_stale_servers_count` | Gauge | Number of active production servers missing scheduled backups (`>26h` staleness) |
| `backuppulse_archive_size_bytes` | Gauge | Size in bytes of the most recently ingested backup archive by project and server |
| `backuppulse_duration_seconds` | Gauge | Execution time in seconds of the most recently ingested backup run |
| `backuppulse_active_api_keys` | Gauge | Count of active, unrevoked scoped API tokens in PostgreSQL |
| Standard Node.js Metrics | Gauges/Counters | Process CPU, resident memory (`process_resident_memory_bytes`), event loop lag, and GC stats |

### Sample Prometheus Scrape Config (`prometheus.yml`)
```yaml
scrape_configs:
  - job_name: 'backuppulse'
    scrape_interval: 30s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['backuppulse-hub:3000']
```

---

## 🌐 Timezone Display Switcher (UTC vs Local Browser Time)

Distributed operations teams frequently manage servers spread across different global regions. BackupPulse features an instant **Timezone Switcher**:

- **Persistent Preference**: Stored in client `localStorage` and accessible from the top navbar or the enterprise sidebar.
- **1-Click Toggle**: Switch instantly between **🌐 UTC** and **🕒 Local Browser Time**.
- **System-Wide Formatting**: Automatically re-formats all timestamps across:
  - Backup Telemetry data table execution windows
  - Retention availability remaining tooltips
  - Incident details inspector modal
  - Notification delivery audit log receipts
  - User login tracker events

---

## 🏗️ Versioned Database Migration Pipeline (`prisma migrate deploy`)

For zero-downtime, predictable production upgrades:
- Transitioned from ad-hoc schema pushes to formal, versioned migrations under `backend/prisma/migrations/`.
- Container startup in `entrypoint.sh` executes `npx prisma migrate deploy` automatically before starting the Node.js server.
- Automatically handles new columns and indexes with zero risk of schema drift.

---

## 📦 Docker Daemon Automated Log Rotation

To prevent container `stdout` and `stderr` logs from consuming all disk space on the host Docker node:
- Configured JSON-file log rotation parameters directly on all containers in `docker-compose.yml`:
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```
- Retains at most **3 rotated files of 10 MB each** per service (`postgres` and `app`), capping log consumption at 30 MB per container.

---

## 🧪 Interactive Dummy Data & Scenario Generator

Load realistic telemetry data and test edge cases into your dashboard using the interactive CLI script:

```bash
chmod +x scripts/load_dummy_data.sh
./scripts/load_dummy_data.sh
```

### Menu Options:
- **`[1] Full Production Dataset`**: Generates 40+ multi-day reports across 10 projects and 15 servers, populating the 7-day trend chart, storage breakdown, and success ratios.
- **`[2] Failure Scenarios Only`**: Simulates 5 distinct failure conditions (out-of-disk space, S3 permission denied, connection loss, checksum mismatch, memory limits) with complete error traces.
- **`[3] Single Report Test`**: An interactive wizard to fire a custom test backup report (SUCCESS or FAILED) for any project/server in 1 second.
- **`[4] 100-Server Fleet Simulation`**: Rapid batch ingestion of 100 server backup events in parallel to test high-throughput performance.
- **`[5] Change API Target`**: Point the script to any local or remote BackupPulse endpoint.

---

## 📄 License

This project is open-source and free to use under the terms of the [MIT License](LICENSE).
Feel free to use, adapt, and build upon it for personal, team, or enterprise production environments.

