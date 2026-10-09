# 📊 BackupPulse — Enterprise Grafana Dashboard & Prometheus Monitoring

This directory contains production-ready **Grafana Dashboards** and **Prometheus Configurations** for **BackupPulse — Centralized Backup Telemetry & Monitoring System**.

---

## 🚀 Quick Start: 1-Click Import into Grafana

If you already have a running Grafana instance:

1. Open your **Grafana UI** (`http://localhost:3001` or your company's Grafana domain).
2. In the left navigation bar, go to **Dashboards** → **New** → **Import** (or visit `/dashboard/import`).
3. Click **Upload dashboard JSON file** and select:
   ```
   grafana/backuppulse-dashboard.json
   ```
   *(Or open `backuppulse-dashboard.json`, copy the entire raw JSON text, and paste it into the **Import via panel json** box).*
4. Select your **Prometheus Datasource** from the dropdown.
5. Click **Import**. Your BackupPulse Telemetry Dashboard is live!

---

## 📁 Directory Structure

```text
grafana/
├── backuppulse-dashboard.json           # Standalone dashboard JSON for 1-click import
├── dashboards/
│   └── backuppulse-overview.json        # Provisioning copy of the dashboard
├── provisioning/
│   ├── dashboards/
│   │   └── dashboards.yaml              # Automatic dashboard provisioning provider
│   └── datasources/
│       └── prometheus-datasource.yaml   # Automatic Prometheus datasource provisioning
├── prometheus.yml                       # Prometheus scrape config targeting BackupPulse
└── README.md                            # Comprehensive setup & metrics documentation
```

---

## 📡 Prometheus Scrape Configuration

BackupPulse exposes standard Prometheus metrics out of the box on `/metrics` (e.g. `http://localhost:3000/metrics`).

Add the following scrape job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'backuppulse-hub'
    metrics_path: '/metrics'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000'] # Change to app:3000 in Docker or your hub hostname
        labels:
          environment: 'production'
          service: 'backuppulse'
```

---

## 🐳 Full Stack Docker Compose Integration

To run **BackupPulse + Prometheus + Grafana** together in a unified Docker Compose setup, add Prometheus and Grafana services to your `docker-compose.yml`:

```yaml
services:
  # Prometheus Time-Series Database
  prometheus:
    image: prom/prometheus:latest
    container_name: backup-pulse-prometheus
    restart: unless-stopped
    volumes:
      - ./grafana/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - backup-network

  # Grafana Visualization Server
  grafana:
    image: grafana/grafana:latest
    container_name: backup-pulse-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
      - ./grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - backup-network

volumes:
  prometheus_data:
  grafana_data:
```

---

## 🎨 Dashboard Features & Panel Architecture

The dashboard is organized into **6 high-level telemetry rows** with **23 production panels**:

### 1. 🛡️ Executive SLA & Fleet Telemetry Overview
* **Total Ingested Backups**: Total count of all telemetry reports received across all servers.
* **Backup Success Rate (%)**: Executive SLA percentage metric with dynamic color thresholds (Green $\ge$ 95%, Amber $\ge$ 85%, Red < 85%).
* **Failures (Past 24h)**: Real-time counter of failed backup executions in the past 24 hours. Turns red with high-visibility background when $\ge 1$.
* **Dead Man's Snitch (Silent Hosts)**: Unmonitored or silent hosts that have not dispatched a backup run for $>26$ hours.
* **Active Monitored Hosts**: Total active client servers and nodes reporting into BackupPulse.
* **Provisioned Ingestion Tokens**: Total active API authentication tokens currently valid in the system.

### 2. 📈 Backup Execution Trends & Ingestion Rates
* **Backup Ingestions Over Time by Status**: Stacked time-series bar chart showing real-time distribution of `SUCCESS` (green), `FAILED` (red), and `WARNING` (orange) runs.
* **Backup Ingestion Throughput (Runs/min)**: Live throughput rate of client telemetry requests processed per minute.

### 3. ⏱️ Execution Durations & Breakdown Distributions
* **Backup Execution Duration by Host (Seconds)**: Line chart tracking backup script runtimes with min, mean, and max duration aggregations.
* **Backup Run Status Ratio**: Donut chart displaying the proportional ratio between successful and failed runs.
* **Backup Engine / Type Breakdown**: Donut chart segmenting backups by database type (`db` PostgreSQL/MySQL, `code` files, `full` system).

### 4. 🏆 Project Leaderboards & High Duration Runtimes
* **Top 10 Projects by Backup Activity**: Horizontal bar chart identifying the most active projects by backup frequency.
* **Top 10 Longest Execution Runtimes**: Bar chart highlighting projects and servers with the highest execution times to identify optimization bottlenecks.

### 5. 🖥️ Server Fleet Telemetry Inventory Matrix
* **Monitored Fleet Status & Execution Matrix**: Interactive table listing every registered server host and project alongside total successful runs, failed runs, and last duration with color-coded severity gradients.

### 6. ⚙️ BackupPulse Hub Application & Node.js Runtime Health
* **Process Memory Consumption**: Tracks Node.js Heap Used, Heap Total, and Resident Set Size (RSS) memory in real-time.
* **Process CPU Utilization (%)**: Real-time CPU utilization rate of the BackupPulse hub server.
* **Event Loop Lag & Active Handles**: Microsecond event-loop delay and active asynchronous handles to ensure zero performance degradation.

---

## 🔍 Dynamic Template Variables (Filters)

The dashboard includes 5 multi-select dropdown filters at the top:
1. **Datasource**: Seamlessly switch between Prometheus data sources.
2. **Project**: Multi-select filter across all detected project names (with "All" support).
3. **Server / Host**: Multi-select filter across all hostnames and IPs (with "All" support).
4. **Status**: Filter by `SUCCESS`, `FAILED`, or `WARNING`.
5. **Backup Type**: Filter by `db`, `code`, or `full`.
