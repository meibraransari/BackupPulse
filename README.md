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
       ├──► Health Check: /health
       ├──► Stores Telemetry in PostgreSQL
       └──► Automated Scheduled Reporter (Cron: REPORT_CRON)
              │
              ├──► Channel 1: [Google Chat Webhook (Cards v2)]
              └──► Channel 2: [SMTP Email (Responsive Dark HTML)]
       │
       ▼
[BackupPulse Dashboard] (React + Vite + Tailwind CSS)
       ├──► Summary KPI Cards (Total Backups, Success Rate, Failed count, Storage)
       ├──► Historical Trends (Clickable 7-30 Days Success vs Failure Charts)
       ├──► 🖥️ Server Fleet Inventory Matrix (100+ Servers Health, Storage, Staleness)
       ├──► 📉 Backup Size Anomaly Detection (Zero-Byte & Truncation Guard Badges)
       ├──► 📊 Notification Delivery Audit UI (Google Chat & SMTP History + Payload Inspector)
       ├──► 🧹 Database Storage & Housekeeping Modal (Retention Controls & Force Purge)
       ├──► Advanced Multi-Filter & Resizable Columns (Project, Host, Status, Date)
       ├──► Detail Drawer & Professional Incident Resolution Modal
       └──► Instant Test Actions (Test Google Chat, Test SMTP Email, Export CSV/JSON)
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
```

### 4. Access the Services
* **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
  * Default Username: `admin`
  * Default Password: `Admin@123456`
* **Swagger OpenAPI Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
* **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🔔 Automated Daily Reporting & Notification Matrix

BackupPulse includes a flexible multi-channel notification engine. Depending on your team's workflow, you can choose to enable **both channels**, **only one**, or **disable both** completely via `.env`:

| Mode | `ENABLE_GOOGLE_CHAT` | `ENABLE_SMTP` | Dispatch Behavior |
| :--- | :---: | :---: | :--- |
| **Both Channels** | `true` | `true` | Scheduled cron delivers to both Google Chat Space & SMTP Mail recipients. |
| **Chat Only** | `true` | `false` | Dispatches Google Chat Cards v2 only; SMTP is completely dormant. |
| **Email Only** | `false` | `true` | Dispatches rich HTML email reports only; Google Chat is dormant. |
| **Disabled** | `false` | `false` | Automated reporter cron does not run. Telemetry is saved in DB only. |

### Notification Settings in `.env`

```ini
# Schedule expression (default: 9:00 AM daily)
REPORT_CRON="0 9 * * *"

# --- Channel 1: Google Chat ---
ENABLE_GOOGLE_CHAT=true
GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=...&token=..."

# --- Channel 2: SMTP Email Delivery ---
ENABLE_SMTP=true
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="alerts@yourdomain.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="BackupPulse Central <alerts@yourdomain.com>"
SMTP_TO="devops@yourdomain.com,team-lead@yourdomain.com"
```

### ✉️ Email Report Features
- Responsive dark-mode HTML template designed for mobile and desktop mail clients.
- Executive KPIs: Total Backups, 24h Success Rate %, Failed Count, Total Vault Storage.
- **Dedicated Failure Table**: Lists failed jobs with project, server hostname, backup type, and error traces.
- One-click CTA button to jump directly into the live BackupPulse web dashboard.

### 💬 Google Chat Features
- Google Chat **Cards v2** with color badges (green for 100% healthy, red for failures).
- Highlighted crash reasons and hostnames.
- Interactive deep link button to inspect the incident in BackupPulse.

---

## 💻 Client Shell Script Setup (For 100+ Servers)

Deploy `scripts/backup_agent.sh` to `/usr/local/bin/backup_agent.sh` on your servers.

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

## 📡 Backend API Reference

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server uptime & DB connection check | None |
| `GET` | `/api/docs` | Interactive Swagger UI sandbox | None |
| `POST` | `/api/v1/backups/report` | Telemetry ingestion from shell script (with anomaly detection) | `x-api-key` |
| `POST` | `/api/v1/auth/login` | Admin login | None |
| `GET` | `/api/v1/auth/me` | Current session user | Bearer JWT |
| `GET` | `/api/v1/dashboard/stats` | 24h & all-time summary KPIs | Bearer JWT |
| `GET` | `/api/v1/dashboard/trends` | Daily trends for charts (last 7-30 days) | Bearer JWT |
| `GET` | `/api/v1/dashboard/fleet` | Aggregated 100+ servers fleet health, storage, and staleness matrix | Bearer JWT |
| `GET` | `/api/v1/backups` | Filtered & paginated backup records (supports `isAnomaly` filter) | Bearer JWT |
| `GET` | `/api/v1/backups/:id` | Full details, logs, and S3 paths | Bearer JWT |
| `PATCH` | `/api/v1/backups/:id/status` | Manually mark failed backup as SUCCESS with resolution notes | Bearer JWT |
| `GET` | `/api/v1/backups/export` | Export filtered records to CSV or JSON | Bearer JWT |
| `GET` | `/api/v1/notifications/status` | Check active status of Google Chat & SMTP channels | Bearer JWT |
| `GET` | `/api/v1/notifications/logs` | Query alert send audit logs (channel, recipient, status, payload) | Bearer JWT |
| `POST` | `/api/v1/notifications/test-gchat` | Immediate Google Chat webhook test card | Bearer JWT |
| `POST` | `/api/v1/notifications/test-smtp` | Immediate SMTP email test delivery | Bearer JWT |
| `POST` | `/api/v1/notifications/trigger-daily-report` | Manually dispatch daily report to all enabled channels | Bearer JWT |
| `GET` | `/api/v1/system/housekeeping` | Check database retention policy, counts & purge status | Bearer JWT |
| `POST` | `/api/v1/system/cleanup` | Manually trigger database purge of records older than retention threshold | Bearer JWT |

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

