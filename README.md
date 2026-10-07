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
       ├──► 🧭 Enterprise Dark Sidebar (Workspaces, Instant Actions, Profile, API Link)
       ├──► Summary KPI Cards (Total Backups, Success Rate, Failed count, Storage)
       ├──► Historical Trends (Clickable 7-30 Days Success vs Failure Charts)
       ├──► 🖥️ Server Fleet Inventory Matrix (100+ Servers Health, Storage, Staleness)
       ├──► ⏱️ Dead Man’s Snitch Engine (Silent Server Detection >26h & Host Mute Controls)
       ├──► 📉 Backup Size Anomaly Detection (Zero-Byte & Truncation Guard Badges)
       ├──► 👥 Multi-User Directory (Admin, Operator, Viewer roles & Profile Management)
       ├──► 🔒 Live User Login Tracker (IP, User-Agent, Success/Failure Audits)
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

# View container startup logs & runtime banner
docker compose logs -f app
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

