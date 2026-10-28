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
       ├──► Live Swagger UI: /api/docs (Dynamic Zero-Restart Toggle in Settings)
       ├──► Prometheus Metrics Endpoint: /metrics (Pre-seeded on boot from PostgreSQL)
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
       ├──► 🪞 Disk Sync & Rsync Mirror Engine (1:1 Mirror, Hardlink Snapshots, Pre/Post Hooks, Server Telemetry, Expert Command Editor, Cross-Server Bridge)
       ├──► 🧭 Enterprise Dark Sidebar (Core Workspaces, DevOps Operations, Profile, Timezone)
       ├──► 🏠 1-Click Home Navigation (Logo & Home button reset all filters & refresh telemetry)
       ├──► ⚙️ Zero-Restart Dynamic Settings Engine (PostgreSQL 'system_settings' table, hot-reload, single-card per service, multi-line category filters)
       ├──► 🚀 Deploy New Server Wizard (Two-line tab cards, 1-Click script generator with AWS S3, GCS, Azure, SFTP/FTP, Local, NFS & single-curl destination support)
       ├──► 📅 365-Day Backup SLA Heatmap & Calendar View (Interactive GitHub-style uptime reliability matrix)
       ├──► 🧪 Automated Restoration Drills ("DrillPulse" ephemeral sandbox DR verification)
       ├──► 🏢 Multi-Tenant Project Permissions & Team RBAC (Strict workspace tagging & tenant isolation)
       ├──► 🩺 1-Line Pre-Flight Verification Script (agent-check.sh POSIX environment diagnostics)
       ├──► 🌐 Timezone Display Switcher (Persistent 1-Click Toggle: UTC vs Local Browser Time)
       ├──► 🔑 Per-Server & Per-Project API Tokens Modal (1-Click Revocation & Copy Secret)
       ├──► Summary KPI Cards (Total Backups, Success Rate, Failed count, Storage)
       ├──► Historical Trends (Clickable 7-30 Days Success vs Failure Charts)
       ├──► 🖥️ Server Fleet Inventory Matrix (100+ Servers Health, Storage, Staleness)
       ├──► ⏱️ Dead Man’s Snitch Engine (Silent Server Detection >26h & Host Mute Controls)
       ├──► 📉 Backup Size Anomaly Detection (Zero-Byte & Truncation Guard Badges)
       ├──► 📜 Administrative Governance & Change Audit Log (SOC 2 / ISO 27001 tamper-evident trail, CSV export)
       ├──► 👥 Multi-User Directory (Admin, Operator, Viewer roles & Profile Management)
       ├──► 🔒 Live User Login Tracker (IP, User-Agent, Success/Failure Audits)
       ├──► 📊 Notification Delivery Audit UI (Multi-Channel History + Payload Inspector)
       ├──► 🧹 Database Storage & Housekeeping Modal (Retention Controls & Force Purge)
       ├──► ⚡ Global Command Palette (Ctrl+K / Cmd+K instant fuzzy search across projects, servers, actions)
       ├──► 🎛️ Data Table Column Customizer & Density Switcher (Compact, Normal, Roomy + column popover)
       ├──► 🖥️ Full-Screen NOC Wallboard Mode (TV display with live ticker, big gauges, and 30s auto-refresh)
       ├──► 💻 Advanced Terminal Log Viewer (In-log search, collapsible stages, line numbers, syntax highlights)
       ├──► 🔔 Live In-App Notification Center Drawer (Header bell with audio chime alert & unread counter)
       ├──► Advanced Multi-Filter & Resizable Columns (Project, Host, Status, Date)
       ├──► Detail Drawer & Professional Incident Resolution Modal
       └──► Instant Test Actions (Dedicated test triggers inside each System Settings card: Google Chat, Email, Slack, Discord, Telegram, Export CSV/JSON)
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
* **Swagger OpenAPI Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Toggle dynamically in **System Settings** for production security hardening)
* **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🪞 Disk Sync & Rsync Mirroring Engine

BackupPulse includes a dedicated, container-native **Disk Sync & Rsync Mirroring Engine** that enables scheduled 1:1 disk mirroring, incremental hardlink snapshots, remote SSH synchronization, physical disk mounts, and audit logging.

### Supported Synchronization Strategies

| Strategy | Engine Flags | Behavior & Benefits |
| :--- | :--- | :--- |
| **Exact 1:1 Mirror** | `rsync -av --delete --stats` | Disk 2 is an exact real-time replica of Disk 1. Deletions on Disk 1 are mirrored to Disk 2. Perfect for warm standby and hardware failover. |
| **Time-Machine Snapshots** | `rsync -av --delete --link-dest=../latest --stats` | Creates dated point-in-time snapshot folders (`/disk2/snapshot_YYYY-MM-DD_HH-mm/`). Unchanged files share hardlink inodes taking **0 extra bytes** on disk, allowing infinite version browsing! |
| **Mirror + Safe Recycle Bin** | `rsync -av --delete --backup --backup-dir=...` | Disk 2 contains the current working mirror, but any files modified or deleted on Disk 1 are preserved in a dated recycle bin archive (`/disk2/recycle_bin/DATE/`). |

### Physical Disk Mounting via Docker Compose

To sync physical host disks into the container, define `DISK1_PATH` and `DISK2_PATH` in your `.env` file or mount them directly in `docker-compose.yml`:

```yaml
services:
  app:
    volumes:
      # Physical Source Disk (mounted read-only for safety)
      - ${DISK1_PATH:-/mnt/disk1}:/data/disk1:ro
      # Physical Target Mirror Disk (mounted read-write)
      - ${DISK2_PATH:-/mnt/disk2}:/data/disk2:rw
      # SSH keys directory for cross-server remote sync
      - ${RSYNC_SSH_DIR:-./ssh_keys}:/root/.ssh:ro
```

### Key Architecture & Modern Capabilities

1. **🪝 Pre-Hook & Post-Hook Lifecycle Execution Engine**:
   - **Pre-sync Hook (`preHookCommand`)**: Executes preparation scripts (e.g., stopping active daemon services, initiating database read locks, or creating LVM snapshots) prior to file synchronization.
   - **Post-sync Hook (`postHookCommand`)**: Executes follow-up automation (e.g., restarting services, unlocking databases, flushing cache layers, or dispatching external webhook notifications) after synchronization concludes.
   - **Data-Safety Pre-Hook Abort**: If the pre-hook command fails (non-zero exit code or execution error), the rsync transfer is **aborted immediately**, protecting destination target data from corrupted or inconsistent synchronization.
   - **Dynamic Argument Variable Substitution**: Injects runtime execution context into hook commands using `{variable}` syntax:
     - `{job_id}`: Unique identifier of the sync job.
     - `{job_name}`: Human-readable name of the job.
     - `{trigger}`: Execution trigger (`MANUAL`, `SCHEDULED`, `RETRY`).
     - `{job_sequence}`: Incremental run counter (e.g. `1`, `42`).
     - `{source_id}` & `{source_name}`: Origin repository ID and name.
     - `{destination_id}` & `{destination_name}`: Target repository ID and name.
     - `{started_at}`: ISO timestamp of execution start.
     - `{user_id}` & `{user_name}`: Operator identity (`admin`, `system`).
     - `{completed_at}`: ISO timestamp of completion (*Post-hook only*).
     - `{duration}`: Execution elapsed time in seconds (*Post-hook only*).
     - `{status}`: Run outcome (`SUCCESS`, `FAILED`, `ABORTED`) (*Post-hook only*).
     - `{error}`: Truncated error message if failed (*Post-hook only*).
   - **Dynamic Environment Variables (`BP_*`)**: In addition to argument string substitution, hooks automatically receive runtime variables as shell environment variables:
     - `BP_JOB_ID`, `BP_JOB_NAME`, `BP_TRIGGER`, `BP_JOB_SEQUENCE`, `BP_SOURCE_NAME`, `BP_DEST_NAME`, `BP_STATUS`, `BP_DURATION_SEC`, `BP_ERROR`.
   - **Unified Terminal Logging**: Both pre-hook and post-hook `stdout` and `stderr` streams are cleanly demarcated with section banners in the real-time execution terminal viewer.

2. **📊 On-Demand Remote Server Telemetry (Real-Time Disk, Memory, CPU)**:
   - **Non-Intrusive SSH Probing**: Gathers live system utilization metrics directly over SSH during the "Test Connection" action using lightweight POSIX commands (`df -h /`, `free -b` / `awk`, `/proc/stat` & `top`).
   - **Zero Background Polling Overhead**: Probing is strictly on-demand—no background daemons, cron agents, or continuous SSH polling pinging production servers.
   - **Color-Coded Visual Indicators**: Displayed directly in the Remote SSH Servers inventory table with live horizontal progress bars:
     - 🟢 **Green** (`< 70%`): Optimal capacity & low resource consumption.
     - 🟡 **Amber** (`70% - 89%`): Warning threshold, approaching capacity.
     - 🔴 **Red** (`≥ 90%`): Critical resource exhaustion requiring immediate sysadmin attention.
   - Displays exact percentage and relative timestamp of the last probe.

3. **⚡ Underlying Rsync Command Console & Linux Expert Mode**:
   - **Complete Operational Transparency**: Dedicated **"Rsync Command"** console accessible from both Job Creation and Job Editing dialogs.
   - **System Managed Mode**: Live interactive preview of the dynamic `rsync` command line constructed by BackupPulse according to the selected strategy, exclude patterns, bandwidth limit, and flags.
   - **User Managed (Linux Expert) Mode**: Grants Linux system engineers 100% freedom to customize, edit, and save the entire bash command string, adding custom pipes, shell wrappers, or non-standard rsync flags.
   - **1-Click Linux Expert Preset Flags**: Rapidly inject standard enterprise rsync flags:
     - `--partial`: Keep partially transferred files for fast resume.
     - `--inplace`: Update target files directly in-place without creating intermediate temp files.
     - `--sparse`: Handle sparse filesystem allocations efficiently.
     - `--numeric-ids`: Preserve numeric UID/GID numbers across differing host user databases.
     - `--protect-args`: Prevent remote shell from interpreting wildcards and spaces.
     - `--delete-after`: Perform file deletions on the destination only after all transfers succeed.
     - `--hard-links`: Recreate hard links on destination mirroring the source filesystem.
     - `--compress-level=6`: Explicitly configure zlib compression ratio.
   - **Execution Fidelity**: When `isUserManaged` is active, the engine executes the exact user-defined bash command verbatim in production runs.

4. **🛡️ Central Backup Telemetry & Multi-Channel Alert Policies**:
   - **Central Telemetry Recording (`recordTelemetry`)**:
     - Optional per-job toggle. When enabled, every Rsync run automatically writes a standardized telemetry record to the central `backup_reports` database.
     - Integrated seamlessly into the global 365-day SLA heatmap, server fleet inventory, anomaly detector, and executive KPI aggregations.
   - **Customizable Alert Notification Policies (`notifyPolicy`)**:
     - `NONE`: Suppress notifications (silent execution).
     - `FAILURE_ONLY`: Immediately dispatch failure alerts to DevOps channels if pre-hook, rsync, or post-hook fails.
     - `ALWAYS`: Dispatch notification alerts on both successful completions and unexpected failures.
   - **Enterprise Notification Gateways**: Dispatches rich notifications across all 5 configured notification channels: Google Chat (Cards v2), Dark-Mode HTML Email, Slack (Block Kit), Discord (Rich Embeds), and Telegram (HTML).

5. **🖥️ Dedicated NOC Overview Hub & Isolated Execution History**:
   - **NOC Monitoring Dashboard**:
     - Centralized monitoring console featuring interactive KPI stat cards (Total Jobs, Transferred Volume, Success Rate %, Registered Servers, Storage Repositories).
     - Direct 1-click navigation links jumping straight into filtered target workspaces.
     - Real-time physical storage pool capacity tracking.
   - **Dedicated Execution History Workspace**:
     - Cleanly separated from the overview dashboard to eliminate clutter and provide high-density log management.
     - Limit selector supporting **25 / 50 / 100** runs per page with previous/next pagination.
     - Slide-over terminal viewer with syntax highlighting, stdout/stderr streams, file transfer counts, and exit codes.

6. **📘 Interactive Operations Guide & Activity Audit Governance**:
   - **Built-in Operations Walkthrough Modal**:
     - Accessible via the `(i)` info button next to the header refresh trigger.
     - 5-step interactive guide outlining the complete Rsync workflow:
       1. Register remote SSH servers & credentials.
       2. Define local or remote storage repositories.
       3. Create synchronization jobs with custom schedules & strategies.
       4. Run & test jobs with non-destructive Dry-Run (`-n`) simulation.
       5. Monitor lifecycle logs, terminal output, and central telemetry.
   - **Activity Audit Trail Enhancements**:
     - Tamper-evident governance tracking every job run, create, edit, delete, and test operation.
     - Fast multi-dropdown filters for **Action Type** (Job Run, Create, Update, Delete, Hook Execution) and **Entity Type** (Job, Server, Repository, Run).
     - Draggable, resizable table columns with visual cursor handles and state persistence.
     - Accordion-style collapsible JSON parameter inspector for deep payload debugging.
     - Smooth horizontal scrolling (`overflow-x-auto`) for wide monitor displays.

7. **🔒 Enterprise Confirmation Modals & Non-Root Permission Hardening**:
   - **Professional Modal Dialogs**:
     - Completely replaced browser-native `window.confirm()` and `window.alert()` popups with styled, theme-consistent confirmation modals across all delete, bulk delete, run, and test actions.
     - Non-intrusive toast notifications with auto-dismiss timers and clear status badges.
   - **Cross-Server Delta Bridge & Permission Hardening**:
     - Seamless direct SSH execution for same-host pairs.
     - 2-Stage Delta Bridge with ephemeral staging for distinct remote server pairs.
     - Built-in `--no-owner`, `--no-group`, `--omit-dir-times` flags to prevent permission denied errors (`rsync: chown failed: Operation not permitted`) when syncing to non-root SSH user accounts.
     - Resilient multi-line POSIX `df -B1` parsing avoiding filesystem header misalignments.

### Rsync REST API Endpoints

```
GET    /api/v1/rsync/dashboard             - KPI metrics and storage capacity summary
GET    /api/v1/rsync/jobs                  - List sync jobs (paginated, search, filter)
POST   /api/v1/rsync/jobs                  - Create sync job (with pre/post hooks, customCommand, notifyPolicy, recordTelemetry)
GET    /api/v1/rsync/jobs/:id              - Get sync job details
PUT    /api/v1/rsync/jobs/:id              - Update sync job
DELETE /api/v1/rsync/jobs/:id              - Delete sync job
POST   /api/v1/rsync/jobs/bulk-delete      - Bulk delete jobs
POST   /api/v1/rsync/jobs/:id/run          - Execute job immediately (triggers pre-hook, rsync, post-hook)
POST   /api/v1/rsync/jobs/:id/dry-run      - Simulate job execution (dry-run simulation)
GET    /api/v1/rsync/servers               - List remote SSH servers (includes lastMetrics: disk, memory, cpu)
POST   /api/v1/rsync/servers               - Register remote SSH server credentials
PUT    /api/v1/rsync/servers/:id           - Update remote server credentials
DELETE /api/v1/rsync/servers/:id           - Delete remote server
POST   /api/v1/rsync/servers/bulk-delete   - Bulk delete remote servers
POST   /api/v1/rsync/servers/:id/test      - Test SSH connection & probe realtime Disk/Memory/CPU metrics
GET    /api/v1/rsync/repositories          - List storage repositories / disks
POST   /api/v1/rsync/repositories          - Register storage path
PUT    /api/v1/rsync/repositories/:id      - Update storage repository
DELETE /api/v1/rsync/repositories/:id      - Delete storage repository
POST   /api/v1/rsync/repositories/bulk-delete - Bulk delete storage repositories
POST   /api/v1/rsync/repositories/:id/refresh-space - Probe df -B1 disk capacity
GET    /api/v1/rsync/runs                  - Execution history (paginated, limit 25/50/100)
GET    /api/v1/rsync/runs/:id              - Full run stdout/stderr terminal log (includes hook stages)
DELETE /api/v1/rsync/runs/:id              - Delete single execution log
POST   /api/v1/rsync/runs/bulk-delete      - Bulk delete execution logs
GET    /api/v1/rsync/activity-logs         - Rsync operations audit trail (filterable by action & entity)
```

---

## ⚙️ Zero-Restart Dynamic Settings Engine (Database-Backed Configuration)

BackupPulse features a **Dynamic Configuration Engine** backed by PostgreSQL (`system_settings` table).

### The Problem It Solves
Traditionally, modifying notification webhooks, SMTP credentials, alert cron intervals, or retention periods in containerized applications required:
1. SSHing into production servers.
2. Manually editing the `.env` file.
3. Restarting the Docker container (`docker compose restart app`), causing service interruption.
4. Risking that environment variables get lost or out-of-sync when cloning, migrating, or backing up the database.

### The Solution: Zero-Restart Database Settings
- **PostgreSQL Persistence**: All operational and notification settings are stored in the database (`system_settings` table).
- **Included in Database Backups**: Taking a standard `pg_dump` of BackupPulse includes all system configurations, webhook endpoints, and alert schedules. Migrating or restoring the database restores 100% of your environment.
- **Immediate In-Memory Hot-Reload**: When an administrator saves changes in the **System Settings** page, values are updated directly in memory. Active mail dispatchers and webhook clients use new credentials immediately, and active `node-cron` background tasks are automatically rescheduled on-the-fly **without restarting the container**.
- **Masked Secrets**: Sensitive fields (SMTP passwords, SendGrid API keys, Telegram Bot tokens, Master API tokens) are masked in the UI (`••••••••`) and preserved unless explicitly replaced.
- **Instant Channel Verification**: Directly verify Google Chat, Slack, Discord, Telegram, or Email gateways with 1-click test buttons in the UI.

### What Stays in `.env` vs What Moves to Database

| Setting Scope | Storage | Examples |
| :--- | :--- | :--- |
| **Minimal Bootstrap Only** | `.env` | `DATABASE_URL`, `PORT`, `HOST`, `JWT_SECRET`, `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD` |
| **Dynamic Operational Settings** | Database (`system_settings`) | `APP_BASE_URL`, `INGESTION_API_KEY`, `ENABLE_SWAGGER`, `REPORT_CRON`, `INSTANT_ALERT_ON_FAILURE`, `ENABLE_GOOGLE_CHAT`, `GOOGLE_CHAT_WEBHOOK_URL`, `ENABLE_SLACK`, `SLACK_WEBHOOK_URL`, `ENABLE_DISCORD`, `DISCORD_WEBHOOK_URL`, `ENABLE_TELEGRAM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENABLE_EMAIL`, `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SENDGRID_API_KEY`, `AWS_SES_*`, `DB_RETENTION_DAYS`, `ENABLE_HOUSEKEEPING`, `HOUSEKEEPING_CRON` |

*Note: On first database boot, BackupPulse automatically seeds the `system_settings` table using `.env` fallback values, providing seamless backward compatibility.*

### REST API Endpoints

- `GET /api/v1/settings`: Retrieves all system settings grouped by category with masked secrets (Admin role required).
- `PATCH /api/v1/settings`: Updates settings in the database and immediately updates in-memory services without restart (Admin role required).
- `POST /api/v1/settings/test-channel`: Dispatches a live test message to `google_chat`, `slack`, `discord`, `telegram`, or `email` (Admin role required).

---

## 🏠 1-Click Home Navigation & Telemetry Reset

Clicking the top-left **BackupPulse Logo / Brand Header** or the **Home / Telemetry** tab in the sidebar provides an instant 1-click landing experience:
- Automatically resets all active search queries, status filters, date pickers, and project tag selections back to the default state.
- Smoothly navigates to the primary **Telemetry** workspace.
- Refreshes live metrics and telemetry data from the API.
- Smoothly scrolls the window to the top.

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

### ⚙️ Dynamic Configuration & System Settings Dashboard

All operational settings, Swagger documentation toggles, notification webhooks, SMTP / SendGrid / SES credentials, alert schedules, and database housekeeping policies are managed directly in the Web Dashboard under **System Settings** (`⚙️ System Settings`). There is **zero requirement to edit `.env` or restart containers**:

- **Instant Hot-Reload**: Changes take effect in-memory immediately upon saving.
- **Persistent in PostgreSQL**: Saved in the `system_settings` table, ensuring all endpoints and credentials are safely included in standard database backups (`pg_dump`).
- **Clean Single-Card Architecture**: Each integration and service is cleanly isolated in its own dedicated card, eliminating confusion between different email providers or notification channels:
  - 🌐 **Dynamic Swagger OpenAPI Docs**: Toggle interactive `/api/docs` on/off dynamically for production security hardening without rebuilding or restarting containers.
  - ⚡ **Alerts & Cron Settings**: Toggle instant failure alerts and customize the morning digest cron (e.g., `0 9 * * *`).
  - 💬 **Google Chat**: Incoming Cards v2 webhook URL with a dedicated 1-click test button.
  - ✉️ **Email Dispatch (General)**: Toggle email delivery, select active provider (`smtp`, `sendgrid`, or `ses`), set sender identity, and define comma-separated recipients with a 1-click test dispatch button.
  - 📨 **SMTP Relay**: Dedicated host, port (`587` / `465` / `25`), TLS toggle, username, and masked password card.
  - 🚀 **SendGrid Web API**: Dedicated SendGrid API key card with masked storage and instant test dispatch.
  - ☁️ **AWS SES**: Dedicated AWS region, optional IAM Access Key ID and Secret Access Key (with automatic fallback to AWS instance/pod IAM roles).
  - 💬 **Slack**: Block Kit incoming webhook URL with a dedicated 1-click test button.
  - 🎮 **Discord**: Rich Embed incoming webhook URL with a dedicated 1-click test button.
  - ✈️ **Telegram**: Bot token, destination chat ID, and a dedicated 1-click test button.
  - 🧹 **Database Retention & Housekeeping**: Retention window (days), automated cleanup toggle, and housekeeping cron schedule.
  - 🔑 **API Ingestion & Hub Configuration**: Public hub base URL and central master API key.
- **Multi-Line Wrapping Category Pills & Real-Time Search**:
  - Quickly filter settings by service category (`All Settings`, `General & Security`, `Alerts & Cron`, `Google Chat`, `Email & SMTP`, `SendGrid`, `AWS SES`, `Slack`, `Discord`, `Telegram`, `Housekeeping`) without horizontal scrollbars.
  - Spacious search bar aligned alongside category pills for instant, real-time setting discovery.

Administrators can also view and update these settings programmatically via `GET /api/v1/settings` and `PATCH /api/v1/settings` (or dispatch test alerts via `POST /api/v1/settings/test-channel`).

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
BACKUPPULSE_URL="http://your-backuppulse-hub:3000"
API_TOKEN="bkp_live_secret_key_12345"

curl -s -X POST "${BACKUPPULSE_URL}/api/v1/backups/report" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_TOKEN}" \
  -d '{
    "server_id": "dummy-server-01",
    "hostname": "dummy-server-01.example.com",
    "server_ip": "192.168.1.100",
    "project_name": "ecommerce-db",
    "environment": "production",
    "backup_type": "db",
    "status": "SUCCESS",
    "start_time": "2026-10-08T10:00:00Z",
    "end_time": "2026-10-08T10:05:32Z",
    "duration_seconds": 332,
    "backup_size_bytes": 52428800,
    "backup_size_human": "50 MB",
    "s3_bucket": "backup-demo-dbbackup",
    "s3_key": "demo_db_backup/ecommerce-db-08-Oct-2026_10-00.zip",
    "s3_url": "s3://backup-demo-dbbackup/demo_db_backup/ecommerce-db-08-Oct-2026_10-00.zip",
    "checksum": "a3f5c8e7d91b4c2a6f8e1234567890abcdef1234567890abcdef1234567890ab",
    "zip_filename": "ecommerce-db-08-Oct-2026_10-00.zip",
    "exit_code": 0,
    "retention_days": 30,
    "error_message": null,
    "stdout_log": "pg_dump completed successfully. zip completed successfully. upload completed successfully.",
    "stderr_log": null,
    "metadata": {
      "agent_name": "postgres_s3_backup",
      "db_engine": "postgresql",
      "db_host": "172.31.6.60",
      "db_port": "5432",
      "db_name": "demo_prod",
      "db_user": "localuser",
      "s3_folder": "demo_db_backup",
      "min_size_threshold_bytes": 35840,
      "max_files_retention": 30,
      "retention_days": 30,
      "s3_total_files": 25,
      "s3_files_pruned": 0,
      "anomaly_detected": false,
      "status_summary": "ecommerce-db backup completed successfully and uploaded to S3.",
      "pruned_files_history": []
    }
  }' \
  -w '\n\nHTTP_STATUS: %{http_code}\n'
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

## 🚀 1-Click Script Generator & Deployment Wizard

Setting up and standardizing backup scripts across dozens or hundreds of disparate Linux servers often leads to syntax inconsistencies, missing error handling, and manual configuration errors. 

BackupPulse features a built-in **Deploy New Server Wizard** accessible directly from the dashboard:

- **Two-Line Card Tab Navigation**:
  - 📜 **Full Script**: Complete, production-grade bash backup agent with automated compression, integrity checksums, remote uploads, and error trapping.
  - ⚡ **1-Liner Run**: Copy-paste single command or curl installation script for rapid terminal deployment.
  - 🩺 **Preflight Check**: 10-second environment & connectivity verification script to test prerequisites before running backups.
  - ⏱️ **Crontab Builder**: Visual schedule generator with log redirects and frequency templates.
  - 📋 **Prerequisites**: Required packages, binaries (`awscli`, `curl`, `jq`, `zip`), and permissions tailored to the selected engine and destination.
- **Dedicated Actions Toolbar Row**:
  - 1-click **Copy Script** to clipboard with instant visual feedback.
  - 1-click **Download (.sh)** button to save the customized script directly to your local workstation.
- **Supported Workload Engines**:
  - 🐘 **PostgreSQL**: Native `pg_dump` with custom compressed format, single-quote password isolation, stdout/stderr logging, and table row counts.
  - 🐬 **MySQL / MariaDB**: Online, non-blocking `mysqldump` with `--single-transaction --quick --routines --triggers`, single-quote password safety, and telemetry logging.
  - 🍃 **MongoDB**: Fast `mongodump --archive --gzip` with authentication (or URI string), single-quote password isolation, archive size validation, and execution telemetry.
  - 🔴 **Redis**: `redis-cli --rdb` snapshot (direct non-blocking network stream) or `BGSAVE` trigger, password protection, and automated upload & retention.
  - 🐳 **Docker Volumes**: Ephemeral containerized export via `docker run --rm -v ... alpine tar -czf` for safe, read-only volume snapshots of containerized workloads.
  - 🪶 **SQLite**: Online non-blocking snapshot using SQLite native online backup API (`sqlite3 db ".backup 'backup.sqlite'"`), safe against active writes and concurrent locks.
  - 🗜️ **Directory & File Zip**: Full directory packaging with configurable exclusions (`node_modules/*`, `.git/*`, `cache/*`), size anomaly checks, and stdout/stderr capturing.
  - 🌐 **SFTP / FTP**: Dedicated remote server synchronization via OpenSSH `sftp` batch, `scp`, `sshpass`, or `curl` (supports SFTP port 22 & FTP port 21, Password or SSH Private Key authentication, remote folder targeting, automatic compression, remote retention pruning, and complete execution telemetry).
  - ⚡ **Single curl Snippet**: Minimal JSON snippet to paste into existing proprietary or legacy shell scripts. Supports custom backup type labels and **full storage target selection** (AWS S3, Google Cloud Storage, Azure Blob Storage, Remote SFTP/FTP, Local Storage, Shared Mapped Drive) to populate accurate storage keys, URLs, filenames, and retention metadata automatically.
- **6 Supported Storage Targets**:
  - ☁️ **AWS S3**: Upload via AWS CLI with automatic historical retention pruning (`MAX_FILES`).
  - 🌐 **Google Cloud Storage (GCS)**: Stream to `gs://bucket/prefix` using `gcloud storage` or `gsutil`.
  - 🔷 **Azure Blob Storage**: Upload via `az` CLI or `azcopy` (supports SAS Tokens, Connection Strings, or Azure Managed Identity).
  - 🌐 **Remote SFTP / FTP Server**: Upload database dumps and zip archives directly to remote SFTP/FTP hosts with SSH key or password authentication and automatic remote retention pruning.
  - 💻 **Local Server Path**: Store backups locally on the same server (`/var/backups/...`) with automated local disk retention cleanup.
  - 📁 **Mapped Shared Drive**: Copy directly to mounted network shares (NFS, SMB, CIFS).
- **Interactive Crontab Schedule Builder**:
  - Visual time picker (similar to crontab.guru) with minute, hour, day, month, and day-of-week selections, generating exact crontab strings with log redirects.
- **In-Wizard Scoped API Token Provisioning**:
  - Generate a secure, project-scoped API key in 1 click directly inside the wizard with automated embedding into the generated script.

---

## 🧪 Automated Restoration Drills / Disaster Recovery Verification ("DrillPulse")

> *"A backup that has never been restored is just a hypothesis."*

Many DevOps teams discover their backups are unusable only during an actual disaster due to corrupted zip headers, syntax differences between database versions, or missing decryption keys.

BackupPulse provides **Automated Restoration Verification ("DrillPulse")**:
- **Optional Deployment Checkbox**: Easily enabled during script generation in the Deploy Wizard with zero breaking changes to existing setups.
- **Ephemeral Sandbox Container Restoration**:
  - **PostgreSQL**: Launches an isolated temporary Docker container (`postgres:alpine` on in-memory `tmpfs`), restores the fresh dump via `pg_restore`, and verifies public table counts (`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`).
  - **MySQL**: Launches an ephemeral Docker container (`mysql:8.0` on tmpfs), restores the database dump, and validates table counts.
  - **Directory Zip**: Executes test extraction (`unzip -q -t`) and verifies uncompressed file inventory counts.
  - **Immediate Safe Cleanup**: Ephemeral containers are automatically destroyed (`docker rm -f`) immediately after verification, consuming zero persistent storage.
  - **Graceful Fallback**: If Docker is not present on legacy bare-metal machines, the agent executes binary archive checksum and integrity validation (`unzip -t`) without failing the backup.
- **Telemetry Ingestion & Verification Flags**:
  - Ingests `restore_drill_status` (`SUCCESS` | `FAILED` | `SKIPPED`), `restore_drill_duration_seconds`, `restore_drill_verified_tables`, and `restore_drill_log`.
- **UI & Audit Visibility**:
  - **Telemetry Table**: Highlights certified backups with a `🧪 DR Pass` or `🧪 DR Fail` status badge.
  - **Detail Modal**: Dedicated **Disaster Recovery Restoration Drill** card with entity count, duration, and complete sandbox execution logs.
  - **SOC2 & ISO 27001 Compliance**: Provides immutable proof for compliance auditors that backup archives are consistently verified and restorable.

---

## 📅 365-Day Backup SLA Heatmap & Calendar View

While a 7-day trend chart is great for daily operational work, compliance officers, MSPs, and executive managers require a long-term view of backup consistency across all production servers over 30, 90, or 365 days.

BackupPulse features a **GitHub-style Contribution Heatmap & SLA Calendar**:
- **Comprehensive Daily SLA Metrics**:
  - 🟢 **Dark Green**: 100% successful runs on that date.
  - 🟡 **Amber**: Partial success or size drop warnings.
  - 🔴 **Red**: 1 or more failed backup runs on that date.
  - ⚪ **Muted Slate**: No scheduled runs or maintenance window.
- **Interactive Hover & Filter**:
  - Hovering over any cell displays the exact date, total runs, success/failure breakdown, and daily SLA percentage.
  - Clicking any date instantly filters the entire telemetry data table down to that exact day.
- **Flexible Historical Ranges**:
  - 1-click toggling between **30 Days**, **90 Days**, and **365 Days (Full Year)**.
- **Executive Reliability Cards**:
  - Real-time aggregation of **Overall Fleet SLA %**, **Total Ingested Runs**, **100% Perfect Days**, and **Failed Incidents**.

---

## 🏢 Multi-Tenant Project Permissions & Team RBAC

For MSPs, growing agencies, and multi-team enterprises, operators should only see the servers and backups relevant to their department or client (e.g. Team A manages ERP backups, while Team B manages CRM backups).

BackupPulse enforces **Strict Multi-Tenant Project Permissions**:
- **Granular Scopes**:
  - **Administrators**: Maintain global, unrestricted platform access.
  - **Operators & Viewers**: Can be assigned specific project tags (e.g., `["LJS_ERP", "CRM_PROD"]`) or granted global access.
- **Zero Data-Leak Enforcement**:
  - Project scoping is enforced across **all backend endpoints**:
    - Telemetry queries (`GET /api/v1/backups`)
    - CSV/JSON exports (`GET /api/v1/backups/export`)
    - KPI statistics (`GET /api/v1/dashboard/stats`)
    - Trends and SLA Heatmap (`GET /api/v1/dashboard/heatmap`)
    - Server Fleet Matrix (`GET /api/v1/dashboard/fleet`)
    - Project and Server dropdown options (`GET /api/v1/backups/projects`, `GET /api/v1/backups/servers`)
    - Incident status resolution mutations (`PATCH /api/v1/backups/:id/status`)
- **Admin User Management UI**:
  - User Directory allows administrators to assign projects using interactive tag pills loaded live from active workloads, with support for typing custom project names.
  - User table lists the project access scope assigned to each team member.

---

## 🩺 1-Line Pre-Flight Verification Script (agent-check.sh)

When deploying backup scripts to bare-metal servers or cloud VMs, administrators frequently face missing packages (`pg_dump`, `mysqldump`, `aws-cli`, `az`, `gsutil`, `zip`) or outbound firewall restrictions reaching the central hub.

BackupPulse includes a lightweight **1-Line Pre-Flight Checker**:
```bash
curl -fsSL "https://backuppulse.yourdomain.com/api/v1/scripts/preflight?type=postgres&dest=s3&drill=true" | bash
```

### Diagnostics Verified in ~10 Seconds:
1. **Core POSIX Utilities**: `curl`, `gzip`, `awk`, `date`, `sha256sum`, and `zip`.
2. **Target Engine Client**: `pg_dump` and `psql` (PostgreSQL), `mysqldump` and `mysqladmin` (MySQL), or directory archiving tools.
3. **Storage Target Authentication**:
   - AWS CLI (`aws --version`, `aws sts get-caller-identity`).
   - Google Cloud SDK (`gcloud --version`, active service account authorization).
   - Azure CLI / AzCopy (`az --version`, logged-in accounts).
   - Local or Shared Drive directory write permissions and ownership.
4. **Network Egress to BackupPulse Hub**: Direct HTTP ping validating port and API reachability.
5. **Disk Space Capacity**: Checks local staging directory free capacity (`df -h`).
6. **Docker Daemon Engine**: Verifies Docker daemon status if DrillPulse sandbox testing is enabled.

Exposed directly within the **Deploy New Server Wizard** under the **🩺 Pre-Flight Check** tab with 1-click copy support.

---

## 📡 Backend API Reference

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server uptime & DB connection check (includes `swagger` enabled flag) | None |
| `GET` | `/metrics` | Standard Prometheus metrics exposition (counters, gauges, memory, uptime) | None |
| `GET` | `/api/docs` | Interactive Swagger UI sandbox (toggleable dynamically in System Settings) | None |
| `GET` | `/api/v1/scripts/preflight` | Dynamic 1-line POSIX pre-flight diagnostic script for client machines | None |
| `POST` | `/api/v1/backups/report` | Telemetry ingestion from shell script (rate limit: 120/min, scoped/master key) | `x-api-key` |
| `POST` | `/api/v1/auth/login` | Admin/Operator/Viewer authentication (rate limit: 10/min) | None |
| `GET` | `/api/v1/auth/me` | Current session user profile & permissions | Bearer JWT |
| `GET` | `/api/v1/dashboard/stats` | 24h & all-time summary KPIs | Bearer JWT |
| `GET` | `/api/v1/dashboard/trends` | Daily trends for charts (last 7-30 days) | Bearer JWT |
| `GET` | `/api/v1/dashboard/heatmap` | 30, 90, or 365-day SLA heatmap & metrics (supports project & server scoping) | Bearer JWT |
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

## 📉 Backup Size Anomaly Detection & Fleet Exclusion (Data Loss Warning)

Silent backup failures (e.g. database dump tool exiting cleanly with 0 bytes due to a bad argument, table truncation, or disk exhaustion truncating an archive by 50%) are notoriously difficult to catch:
- **Zero-Byte & Empty Archive Guard**: If a backup reports `SUCCESS` but has an archive size `<= 512 bytes`, BackupPulse automatically flags it as an **Anomaly**, overrides the status to `WARNING`, and attaches an explanatory reason.
- **7-Day Rolling Baseline Drop Analysis**: Compares incoming backup archive size against the rolling 7-day average of successful runs. If the size drops by more than the configured threshold (default `40%`, customizable in System Settings), BackupPulse immediately flags `isAnomaly = true` with exact comparative metrics (e.g. `⚠️ Size Anomaly: -45% compared to 7-day average (5.2 GB → 2.8 GB)`).
- **Server Fleet Exclusion Options**:
  - Exclude specific servers, test environments, or entire server fleets from anomaly monitoring using comma-separated server IDs, hostnames, IPs, or wildcard patterns (e.g. `staging-*`, `test-vm`, `192.168.1.*`, `dev-*`) in **System Settings**.
  - Exclude specific projects using project name patterns (e.g. `temp-*`, `scratch-*`).
  - Muted or unmonitored hosts (`ServerConfig.isMonitored === false`) are also automatically bypassed.
- **Visual Badges & Multi-Channel Alerts**: Size anomalies display distinct amber badges (e.g. `⚠️ -45% (7d)`) across the Telemetry Table, Drawer Inspector, Daily Google Chat Cards, Slack, Discord, Telegram, and SMTP HTML emails.
- **Dedicated Filter**: Quick-toggle button (`⚠️ Anomalies`) in the filter bar to isolate all size anomalies in 1 click.

---

## 📊 Notification Delivery Audit UI

Every dispatch attempt to Google Chat and SMTP is tracked in real-time in the `notification_logs` table:
- **Delivery Receipts**: Audit timestamps, channels, event types (`DAILY_SUMMARY`, `TEST_MESSAGE`, `ALERT`), and recipients (email addresses or webhook URLs).
- **Status Badges**: Visual indicator of `SUCCESS` vs `FAILED` dispatches with full error messages on failure (e.g. SMTP connection timeout or invalid webhook credentials).
- **Interactive Payload Viewer**: Inspect the exact JSON card structure or email metadata sent to recipients, with a one-click copy button.

---

## 🧹 Database Retention & Automated Housekeeping

To prevent unbounded database disk usage across hundreds of production servers generating daily backups, BackupPulse features an automated data retention housekeeping policy configured directly in the Web Dashboard under **System Settings** (`⚙️ System Settings`):

- **Data Retention Window (`DB_RETENTION_DAYS`)**: Maximum days to retain backup telemetry and alert dispatch logs (default: 365 days / 1 year).
- **Automated Housekeeping Toggle (`ENABLE_HOUSEKEEPING`)**: Enable or disable background cron retention purges.
- **Housekeeping Cron Schedule (`HOUSEKEEPING_CRON`)**: Schedule for running database cleanup (default: `0 3 * * *` / 03:00 AM daily).

All retention changes are persisted in PostgreSQL and take effect immediately without modifying `.env` or restarting containers.

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

The web UI is organized around a persistent, responsive dark sidebar with streamlined sections:
- **Core Workspaces**:
  - 🏠 **Home / Telemetry**: Filterable and resizable data grid with inline incident resolution, live KPI counters, and 1-click filter reset.
  - 🧪 **DR Verification Drills**: DrillPulse ephemeral sandbox disaster recovery verification matrix with table counts and execution logs.
  - 🖥️ **Server Fleet Inventory**: 100+ servers health matrix with grid and table modes, anomaly badges, and host mute toggles.
  - 👥 **User Management**: Team member access directory, multi-tenant RBAC project tagging, and live login audit tracker.
  - ⚙️ **System Settings** *(Admin only)*: Zero-restart configuration engine with single-card service management.
- **DevOps Operations**:
  - 📖 **Interactive Swagger UI**: One-click external link to `/api/docs` (dynamically hidden when disabled in System Settings).
  - 📊 **Notification Audit Logs**: Review transmission receipts, event types, delivery statuses, and inspection payloads.
  - 🧹 **Storage & Retention**: Inspect database sizes, configure retention policies, and trigger immediate housekeeping purges.
  - 🚀 **Deploy Server Wizard**: Interactive wizard for generating customized backup agents, preflight checks, and crontabs.
  - 🔑 **API Ingestion Tokens** *(Admin only)*: Manage per-server and per-project scoped authentication tokens.
  - 🌐 **Timezone Switcher**: 1-click toggle between UTC and Local Browser Time.
- **Profile & Logout Footer**: User avatar, identity chip, role badge, profile modal trigger, and sign-out button.

*Note: Notification channel testing is handled directly within each service card in **System Settings** for a clean, distraction-free sidebar.*

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
- **Master Key Backward Compatibility**: The central master ingestion key configured in **System Settings** (or seeded during initial startup) continues to work seamlessly across all existing backup scripts.

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
| `backuppulse_backup_runs_total` | Counter | Total backup reports ingested, labeled by `status`, `project`, `server_id`, `backup_type` (seeded from PostgreSQL on boot) |
| `backuppulse_total_backups_all_time` | Gauge | Total count of all backup reports currently stored in PostgreSQL database |
| `backuppulse_total_backups_24h` | Gauge | Total count of backup reports recorded in the rolling last 24 hours |
| `backuppulse_failures_24h` | Gauge | Total backup failures recorded across the fleet in the rolling last 24 hours |
| `backuppulse_stale_servers_count` | Gauge | Number of active production servers missing scheduled backups (`>26h` staleness Dead Man's Snitch) |
| `backuppulse_archive_size_bytes` | Gauge | Size in bytes of the most recently ingested backup archive by project and server |
| `backuppulse_duration_seconds` | Gauge | Execution time in seconds of the most recently ingested backup run by project and server |
| `backuppulse_active_api_keys` | Gauge | Count of active, unrevoked scoped API tokens in PostgreSQL |
| Standard Node.js Metrics | Gauges/Counters | Process CPU, resident memory (`process_resident_memory_bytes`), event loop lag, and GC stats |

### ⚡ Automatic Database Seeding on Startup & Hot Scrapes
To ensure external monitoring systems like **Grafana** reflect complete historical telemetry (rather than starting at zero or missing long-term data after a restart):
- **Startup Initialization**: On backend boot, `initMetrics()` queries PostgreSQL to seed historical backup run counters, latest archive sizes, and run durations across all servers and projects.
- **Dynamic Scrapes**: Every scrape of `/metrics` dynamically updates rolling 24-hour totals, failure counts, active API keys, and Dead Man's Snitch stale server calculations in real-time.

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

## 📜 Administrative Governance & Change Audit Log (SOC 2 / ISO 27001 Ready)

Enterprise engineering management and security compliance auditors (SOC 2 Type II, ISO 27001, HIPAA) require a tamper-evident audit trail of all administrative and privileged actions across the infrastructure.

BackupPulse includes a dedicated **Audit & Governance Workspace** backed by the `admin_audit_logs` PostgreSQL table:

### What Is Automatically Audited:
1. **🔑 API Key Lifecycles**: Records who created or revoked master or scoped ingestion tokens, along with assigned project/server scopes and expiration windows.
2. **⚙️ Dynamic System Configuration**: Records who altered live settings (notification webhook URLs, email SMTP credentials, alert channels, retention periods, or SLA thresholds) with the exact modified keys.
3. **🛡️ Incident Resolutions**: When a failed backup incident is manually acknowledged and marked as "Resolved", the system records the operator username, target incident ID, and the required justification note entered by the engineer.
4. **👥 User Lifecycle & Access Control**: Tracks user creation, role modifications (`admin`, `operator`, `viewer`), project permission scoping, and account deletions.

### Key Governance Features:
- **🔒 Automatic Secret Sanitization**: High-entropy credentials, passwords, tokens, and authorization headers are automatically replaced with `••••••••` before persisting to ensure zero leakage.
- **📊 4 KPI Executive Metrics**: Total governance events recorded, events in last 24h/30d, key lifecycle count, and incident resolution count.
- **🔍 Granular Category & Action Filtering**: Filter by category (`SECURITY`, `SETTINGS`, `INCIDENT`, `USER_MANAGEMENT`, `SYSTEM`), action code, operator username, date range presets (All Time, Last 24h, Last 7d, Last 30d), and full-text search.
- **📥 1-Click CSV Export**: Stream audit records directly into RFC-compliant CSV files formatted for compliance auditors and external reviews.
- **🛡️ Strict RBAC Enforcement**: Only users with the `admin` role can access audit logs and export endpoints.

---

## 🎨 Enterprise UI & Operations Center Superpowers

BackupPulse provides modern, keyboard-first, and mission-critical visual interfaces tailored for high-velocity engineering teams:

### 1. ⚡ Global Command Palette (`Ctrl+K` / `Cmd+K` / `/`)
- **Instant Global Search**: Jump to any project (`telluridehub-prod`), server hostname, or server IP from anywhere in the app.
- **Quick Actions**: 1-click or arrow-key triggers to open Deploy Server Wizard, API Tokens, Housekeeping, toggle UTC/Local timezone, or export CSV.
- **Keyboard-First Navigation**: Use `↑` `↓` to navigate, `Enter` to execute, and `Esc` to dismiss.

### 2. 🎛️ Data Table Column Customizer & Display Density Switcher
- **Column Customizer Popover**: Show or hide any column (*Status, Availability, Project/Host, Workload Type, Archive Size, Duration, S3 Key, Timestamp*) with real-time browser storage persistence.
- **3 Density Profiles**:
  - **Compact**: Tight row heights to monitor 30+ production nodes simultaneously without vertical scrolling.
  - **Normal**: Standard balanced spacing.
  - **Roomy / Comfortable**: Expanded row padding with larger status badges.
- **Saved Filter Presets (Pills)**: 1-click filter shortcuts above the table (`[🔄 All Backups]`, `[🚨 Only Failures]`, `[🐘 PostgreSQL]`, `[🐬 MySQL]`, `[📦 Large Dumps (GB+)]`, `[⚠️ Size Anomalies]`).

### 3. 🖥️ Full-Screen "NOC / TV Wallboard" Mode (Operations Center Display)
- **Designed for 24/7 Ops Rooms & Office Wall TVs**: 1-click high-contrast kiosk mode with native HTML5 fullscreen support.
- **Live Animated Status Ticker**: Real-time glowing banner highlighting overall fleet health (`100% HEALTHY` vs `CRITICAL ATTENTION REQUIRED: X FAILURES`).
- **30-Second Auto-Refresh Cycle**: Countdown timer circle and real-time clock ticker.
- **High-Visibility Giant Gauges**: Large 24h success rate percentage gauge, total protected storage footprint, healthy/stale/failing server tallies, and active telemetry stream.

### 4. 💻 Advanced Terminal Log Viewer with In-Log Search & Syntax Highlighting
- **Live In-Log Search (`Ctrl+F`)**: Instant regex search with match counts ("3 hits") and keyword highlights across `stdout` and `stderr`.
- **Intelligent Syntax Color-Coding**: Errors and exit failures in glowing red, shell commands in cyan, completion milestones in emerald.
- **Collapsible Execution Stages**: Automatically detects `[1/5]`, `[2/5]`, etc., and formats backup phases into collapsible accordion steps.
- **Line Numbers & 1-Click Export**: Copy full log, copy error trace, or download raw `.log` file.

### 5. 🔔 Live In-App Notification Center Drawer (Header Bell with Audio Alert)
- **Header Bell with Unread Badge**: Pulsing red indicator displaying active unacknowledged incidents.
- **Slide-Over Alert Drawer**: Shows recent backup failures and multi-channel delivery receipts (Google Chat, Slack, Discord, Telegram, Email).
- **Web Audio API Chime Synthesizer**: Pleasant two-tone bell alert for new incidents with an instant sound on/off mute toggle.
- **1-Click "Inspect Incident"**: Directly jumps to the failing report's terminal logs.

---

## 📄 License

This project is open-source and free to use under the terms of the [MIT License](LICENSE).
Feel free to use, adapt, and build upon it for personal, team, or enterprise production environments.

