const fs = require('fs');
const path = require('path');

const dashboard = {
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "grafana",
          "uid": "-- Grafana --"
        },
        "enable": true,
        "hide": true,
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "description": "Production Grafana dashboard for BackupPulse centralized backup telemetry, SLA monitoring, Dead Man's Snitch silent host tracking, and Node.js runtime health.",
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [
    {
      "asDropdown": false,
      "icon": "external link",
      "includeVars": false,
      "keepTime": false,
      "tags": [],
      "targetBlank": true,
      "title": "BackupPulse Web Dashboard",
      "tooltip": "Open BackupPulse Live UI",
      "type": "link",
      "url": "http://localhost:3000"
    },
    {
      "asDropdown": false,
      "icon": "doc",
      "includeVars": false,
      "keepTime": false,
      "tags": [],
      "targetBlank": true,
      "title": "Swagger API Docs",
      "tooltip": "Explore OpenAPI / Swagger Documentation",
      "type": "link",
      "url": "http://localhost:3000/docs"
    }
  ],
  "liveNow": false,
  "panels": [
    // -------------------------------------------------------------
    // ROW 1: Executive KPI Summary
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 },
      "id": 100,
      "title": "🛡️ Executive SLA & Fleet Telemetry Overview",
      "type": "row"
    },
    {
      "id": 1,
      "title": "Total Ingested Backups",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 0, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "fixed", "fixedColor": "blue" },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [{ "color": "blue", "value": null }]
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum(backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\", status=~\"$status\", backup_type=~\"$backup_type\"}) or vector(0)",
          "instant": true,
          "legendFormat": "Total Backups",
          "range": false,
          "refId": "A"
        }
      ]
    },
    {
      "id": 2,
      "title": "Backup Success Rate",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 4, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "thresholds" },
          "mappings": [],
          "max": 100,
          "min": 0,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "yellow", "value": 85 },
              { "color": "green", "value": 95 }
            ]
          },
          "unit": "percent"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "(((sum(backuppulse_backup_runs_total{status=\"SUCCESS\", project=~\"$project\", server=~\"$server\", backup_type=~\"$backup_type\"}) or vector(0)) / (sum(backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\", backup_type=~\"$backup_type\"}) > 0)) * 100) or vector(100)",
          "instant": true,
          "legendFormat": "Success Rate",
          "range": false,
          "refId": "A"
        }
      ]
    },
    {
      "id": 3,
      "title": "Failures (Past 24h)",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 8, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "thresholds" },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "red", "value": 1 }
            ]
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "background",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_failures_24h",
          "instant": true,
          "legendFormat": "Failures 24h",
          "range": false,
          "refId": "A"
        }
      ]
    },
    {
      "id": 4,
      "title": "Dead Man's Snitch (Silent Hosts)",
      "description": "Monitored hosts that have not dispatched a backup report in over 26 hours.",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 12, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "thresholds" },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 2 }
            ]
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "background",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_stale_servers_count",
          "instant": true,
          "legendFormat": "Silent Hosts (>26h)",
          "range": false,
          "refId": "A"
        }
      ]
    },
    {
      "id": 5,
      "title": "Active Monitored Hosts",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 16, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "fixed", "fixedColor": "purple" },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [{ "color": "purple", "value": null }]
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "count(count by (server) (backuppulse_backup_runs_total{project=~\"$project\"})) or vector(0)",
          "instant": true,
          "legendFormat": "Monitored Servers",
          "range": false,
          "refId": "A"
        }
      ]
    },
    {
      "id": 6,
      "title": "Provisioned Ingestion Tokens",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 20, "y": 1 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "fixed", "fixedColor": "teal" },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [{ "color": "teal", "value": null }]
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.0.0",
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_active_api_keys",
          "instant": true,
          "legendFormat": "Active API Keys",
          "range": false,
          "refId": "A"
        }
      ]
    },

    // -------------------------------------------------------------
    // ROW 2: Telemetry Trends & Activity
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 5 },
      "id": 101,
      "title": "📈 Backup Execution Trends & Ingestion Rates",
      "type": "row"
    },
    {
      "id": 7,
      "title": "Backup Run Ingestions Over Time by Status",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 15, "x": 0, "y": 6 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "custom": {
            "drawStyle": "bars",
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "fillOpacity": 80,
            "gradientMode": "none",
            "stacking": { "mode": "normal", "group": "A" },
            "axisPlacement": "auto"
          },
          "mappings": [],
          "unit": "short"
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "SUCCESS" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "green", "mode": "fixed" } }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "FAILED" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "red", "mode": "fixed" } }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "WARNING" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "orange", "mode": "fixed" } }
            ]
          }
        ]
      },
      "options": {
        "legend": {
          "calcs": ["sum", "lastNotNull"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "multi", "sort": "desc" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum by (status) (increase(backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\", status=~\"$status\", backup_type=~\"$backup_type\"}[$__rate_interval]))",
          "legendFormat": "{{status}}",
          "range": true,
          "refId": "A"
        }
      ]
    },
    {
      "id": 8,
      "title": "Backup Ingestion Throughput (Runs / Min)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 9, "x": 15, "y": 6 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "fillOpacity": 25,
            "gradientMode": "opacity",
            "axisPlacement": "auto"
          },
          "unit": "rpm"
        },
        "overrides": []
      },
      "options": {
        "legend": {
          "calcs": ["mean", "max"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "single", "sort": "none" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum(rate(backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\"}[$__rate_interval])) * 60",
          "legendFormat": "Throughput (runs/min)",
          "range": true,
          "refId": "A"
        }
      ]
    },

    // -------------------------------------------------------------
    // ROW 3: Durations & Distributions
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 14 },
      "id": 102,
      "title": "⏱️ Execution Durations & Breakdown Distributions",
      "type": "row"
    },
    {
      "id": 9,
      "title": "Backup Execution Duration by Host (Seconds)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 15 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "linear",
            "lineWidth": 2,
            "fillOpacity": 10,
            "pointSize": 5,
            "showPoints": "auto",
            "axisPlacement": "auto"
          },
          "unit": "s"
        },
        "overrides": []
      },
      "options": {
        "legend": {
          "calcs": ["lastNotNull", "max", "mean"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "multi", "sort": "desc" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_backup_duration_seconds{project=~\"$project\", server=~\"$server\"}",
          "legendFormat": "{{server}} ({{project}})",
          "range": true,
          "refId": "A"
        }
      ]
    },
    {
      "id": 10,
      "title": "Backup Run Status Ratio",
      "type": "piechart",
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 15 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "unit": "short"
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "SUCCESS" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "green", "mode": "fixed" } }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "FAILED" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "red", "mode": "fixed" } }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "WARNING" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "orange", "mode": "fixed" } }
            ]
          }
        ]
      },
      "options": {
        "displayLabels": ["percent"],
        "legend": {
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true,
          "values": ["value", "percent"]
        },
        "pieType": "donut",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "tooltip": { "mode": "single" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum by (status) (backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\"})",
          "legendFormat": "{{status}}",
          "range": false,
          "instant": true,
          "refId": "A"
        }
      ]
    },
    {
      "id": 11,
      "title": "Backup Engine / Type Breakdown",
      "type": "piechart",
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 15 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "displayLabels": ["name", "percent"],
        "legend": {
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true,
          "values": ["value"]
        },
        "pieType": "donut",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "tooltip": { "mode": "single" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum by (backup_type) (backuppulse_backup_runs_total{project=~\"$project\", server=~\"$server\"})",
          "legendFormat": "{{backup_type}}",
          "range": false,
          "instant": true,
          "refId": "A"
        }
      ]
    },

    // -------------------------------------------------------------
    // ROW 4: Fleet & Project Leaderboards
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 23 },
      "id": 103,
      "title": "🏆 Project Leaderboards & High Duration Runtimes",
      "type": "row"
    },
    {
      "id": 12,
      "title": "Top 10 Projects by Backup Activity",
      "type": "barchart",
      "gridPos": { "h": 7, "w": 12, "x": 0, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "axisPlacement": "auto",
            "fillOpacity": 80,
            "gradientMode": "scheme",
            "lineWidth": 1
          },
          "unit": "short"
        },
        "overrides": []
      },
      "options": {
        "barRadius": 0.2,
        "barWidth": 0.6,
        "groupWidth": 0.7,
        "legend": { "displayMode": "hidden" },
        "orientation": "horizontal",
        "showValue": "auto",
        "tooltip": { "mode": "single" },
        "xTickLabelRotation": 0
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "topk(10, sum by (project) (backuppulse_backup_runs_total{server=~\"$server\"}))",
          "legendFormat": "{{project}}",
          "range": false,
          "instant": true,
          "refId": "A"
        }
      ]
    },
    {
      "id": 13,
      "title": "Top 10 Longest Execution Runtimes",
      "type": "barchart",
      "gridPos": { "h": 7, "w": 12, "x": 12, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "fixed", "fixedColor": "amber" },
          "custom": {
            "axisPlacement": "auto",
            "fillOpacity": 80,
            "gradientMode": "opacity",
            "lineWidth": 1
          },
          "unit": "s"
        },
        "overrides": []
      },
      "options": {
        "barRadius": 0.2,
        "barWidth": 0.6,
        "groupWidth": 0.7,
        "legend": { "displayMode": "hidden" },
        "orientation": "horizontal",
        "showValue": "auto",
        "tooltip": { "mode": "single" },
        "xTickLabelRotation": 0
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "topk(10, max by (project, server) (backuppulse_backup_duration_seconds))",
          "legendFormat": "{{project}} ({{server}})",
          "range": false,
          "instant": true,
          "refId": "A"
        }
      ]
    },

    // -------------------------------------------------------------
    // ROW 5: Detailed Fleet Inventory Table
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 31 },
      "id": 104,
      "title": "🖥️ Server Fleet Telemetry Inventory Matrix",
      "type": "row"
    },
    {
      "id": 14,
      "title": "Monitored Fleet Status & Execution Matrix",
      "type": "table",
      "gridPos": { "h": 9, "w": 24, "x": 0, "y": 32 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "thresholds" },
          "custom": {
            "align": "auto",
            "cellOptions": { "type": "auto" },
            "inspect": false
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [{ "color": "blue", "value": null }]
          }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "Failed Backups" },
            "properties": [
              {
                "id": "custom.cellOptions",
                "value": { "mode": "gradient", "type": "color-background" }
              },
              {
                "id": "thresholds",
                "value": {
                  "mode": "absolute",
                  "steps": [
                    { "color": "transparent", "value": null },
                    { "color": "red", "value": 1 }
                  ]
                }
              }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "Successful Backups" },
            "properties": [
              {
                "id": "custom.cellOptions",
                "value": { "mode": "gradient", "type": "color-background" }
              },
              {
                "id": "thresholds",
                "value": {
                  "mode": "absolute",
                  "steps": [
                    { "color": "transparent", "value": null },
                    { "color": "green", "value": 1 }
                  ]
                }
              }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "Last Duration" },
            "properties": [
              { "id": "unit", "value": "s" }
            ]
          }
        ]
      },
      "options": {
        "footer": {
          "countRows": false,
          "fields": "",
          "reducer": ["sum"],
          "show": true
        },
        "showHeader": true,
        "sortBy": [{ "desc": true, "displayName": "Failed Backups" }]
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum by (server, project) (backuppulse_backup_runs_total{status=\"SUCCESS\"})",
          "format": "table",
          "instant": true,
          "legendFormat": "Successful Backups",
          "range": false,
          "refId": "Success"
        },
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "sum by (server, project) (backuppulse_backup_runs_total{status=\"FAILED\"})",
          "format": "table",
          "instant": true,
          "legendFormat": "Failed Backups",
          "range": false,
          "refId": "Failed"
        },
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "max by (server, project) (backuppulse_backup_duration_seconds)",
          "format": "table",
          "instant": true,
          "legendFormat": "Last Duration",
          "range": false,
          "refId": "Duration"
        }
      ],
      "transformations": [
        {
          "id": "merge",
          "options": {}
        },
        {
          "id": "organize",
          "options": {
            "excludeByName": { "Time": true },
            "renameByName": {
              "Value #Success": "Successful Backups",
              "Value #Failed": "Failed Backups",
              "Value #Duration": "Last Duration",
              "project": "Project",
              "server": "Server Hostname / IP"
            }
          }
        }
      ]
    },

    // -------------------------------------------------------------
    // ROW 6: BackupPulse Node.js Runtime & Application Health
    // -------------------------------------------------------------
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 41 },
      "id": 105,
      "title": "⚙️ BackupPulse Hub Application & Node.js Runtime Health",
      "type": "row"
    },
    {
      "id": 15,
      "title": "Process Memory Consumption (Heap vs Resident RSS)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 42 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "fillOpacity": 15,
            "axisPlacement": "auto"
          },
          "unit": "bytes"
        },
        "overrides": []
      },
      "options": {
        "legend": {
          "calcs": ["lastNotNull", "max"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "multi", "sort": "desc" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_nodejs_heap_size_used_bytes",
          "legendFormat": "Heap Used",
          "range": true,
          "refId": "A"
        },
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_nodejs_heap_size_total_bytes",
          "legendFormat": "Heap Allocated",
          "range": true,
          "refId": "B"
        },
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_process_resident_memory_bytes",
          "legendFormat": "RSS Memory",
          "range": true,
          "refId": "C"
        }
      ]
    },
    {
      "id": 16,
      "title": "BackupPulse Process CPU Utilization",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 42 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "fixed", "fixedColor": "orange" },
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "fillOpacity": 20,
            "gradientMode": "opacity",
            "axisPlacement": "auto"
          },
          "max": 100,
          "min": 0,
          "unit": "percent"
        },
        "overrides": []
      },
      "options": {
        "legend": {
          "calcs": ["mean", "max", "lastNotNull"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "single" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "rate(backuppulse_process_cpu_seconds_total[$__rate_interval]) * 100",
          "legendFormat": "CPU Usage (%)",
          "range": true,
          "refId": "A"
        }
      ]
    },
    {
      "id": 17,
      "title": "Event Loop Lag & Active Handles",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 42 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "fillOpacity": 10,
            "axisPlacement": "auto"
          },
          "unit": "s"
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "Active Handles" },
            "properties": [
              { "id": "unit", "value": "short" },
              { "id": "custom.axisPlacement", "value": "right" }
            ]
          }
        ]
      },
      "options": {
        "legend": {
          "calcs": ["lastNotNull", "max"],
          "displayMode": "table",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": { "mode": "multi", "sort": "desc" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_nodejs_eventloop_lag_seconds",
          "legendFormat": "Event Loop Lag (s)",
          "range": true,
          "refId": "A"
        },
        {
          "datasource": { "type": "prometheus", "uid": "${datasource}" },
          "editorMode": "code",
          "expr": "backuppulse_nodejs_active_handles_total",
          "legendFormat": "Active Handles",
          "range": true,
          "refId": "B"
        }
      ]
    }
  ],
  "refresh": "30s",
  "schemaVersion": 38,
  "style": "dark",
  "tags": [
    "backuppulse",
    "backup-monitoring",
    "prometheus",
    "devops",
    "telemetry",
    "infrastructure"
  ],
  "templating": {
    "list": [
      {
        "current": {
          "selected": true,
          "text": "Prometheus",
          "value": "Prometheus"
        },
        "hide": 0,
        "includeAll": false,
        "label": "Datasource",
        "multi": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "regex": "",
        "skipUrlSync": false,
        "type": "datasource"
      },
      {
        "allValue": ".*",
        "current": {
          "selected": true,
          "text": "All",
          "value": "$__all"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${datasource}"
        },
        "definition": "label_values(backuppulse_backup_runs_total, project)",
        "hide": 0,
        "includeAll": true,
        "label": "Project",
        "multi": true,
        "name": "project",
        "options": [],
        "query": {
          "query": "label_values(backuppulse_backup_runs_total, project)",
          "refId": "StandardVariableQuery"
        },
        "refresh": 2,
        "regex": "",
        "skipUrlSync": false,
        "sort": 1,
        "type": "query"
      },
      {
        "allValue": ".*",
        "current": {
          "selected": true,
          "text": "All",
          "value": "$__all"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${datasource}"
        },
        "definition": "label_values(backuppulse_backup_runs_total{project=~\"$project\"}, server)",
        "hide": 0,
        "includeAll": true,
        "label": "Server / Host",
        "multi": true,
        "name": "server",
        "options": [],
        "query": {
          "query": "label_values(backuppulse_backup_runs_total{project=~\"$project\"}, server)",
          "refId": "StandardVariableQuery"
        },
        "refresh": 2,
        "regex": "",
        "skipUrlSync": false,
        "sort": 1,
        "type": "query"
      },
      {
        "allValue": ".*",
        "current": {
          "selected": true,
          "text": "All",
          "value": "$__all"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${datasource}"
        },
        "definition": "label_values(backuppulse_backup_runs_total, status)",
        "hide": 0,
        "includeAll": true,
        "label": "Status",
        "multi": true,
        "name": "status",
        "options": [],
        "query": {
          "query": "label_values(backuppulse_backup_runs_total, status)",
          "refId": "StandardVariableQuery"
        },
        "refresh": 2,
        "regex": "",
        "skipUrlSync": false,
        "sort": 1,
        "type": "query"
      },
      {
        "allValue": ".*",
        "current": {
          "selected": true,
          "text": "All",
          "value": "$__all"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${datasource}"
        },
        "definition": "label_values(backuppulse_backup_runs_total, backup_type)",
        "hide": 0,
        "includeAll": true,
        "label": "Backup Type",
        "multi": true,
        "name": "backup_type",
        "options": [],
        "query": {
          "query": "label_values(backuppulse_backup_runs_total, backup_type)",
          "refId": "StandardVariableQuery"
        },
        "refresh": 2,
        "regex": "",
        "skipUrlSync": false,
        "sort": 1,
        "type": "query"
      }
    ]
  },
  "time": {
    "from": "now-24h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h"
    ]
  },
  "timezone": "browser",
  "title": "🛡️ BackupPulse — Enterprise Backup Telemetry & Fleet Monitor",
  "uid": "backuppulse-overview",
  "version": 1,
  "weekStart": ""
};

// Target directory
const targetDir = path.join(__dirname, '..', 'grafana');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const dashboardsDir = path.join(targetDir, 'dashboards');
if (!fs.existsSync(dashboardsDir)) {
  fs.mkdirSync(dashboardsDir, { recursive: true });
}

// Write to both grafana/backuppulse-dashboard.json and grafana/dashboards/backuppulse-overview.json
const jsonString = JSON.stringify(dashboard, null, 2);
fs.writeFileSync(path.join(targetDir, 'backuppulse-dashboard.json'), jsonString, 'utf8');
fs.writeFileSync(path.join(dashboardsDir, 'backuppulse-overview.json'), jsonString, 'utf8');

console.log('✅ Grafana dashboard JSON generated successfully:');
console.log(' - ' + path.join(targetDir, 'backuppulse-dashboard.json'));
console.log(' - ' + path.join(dashboardsDir, 'backuppulse-overview.json'));
