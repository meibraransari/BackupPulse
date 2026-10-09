-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "full_name" TEXT,
    "avatar" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "server_id" TEXT,
    "project_name" TEXT,
    "created_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_reports" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "server_ip" TEXT,
    "project_name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "backup_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "backup_size_bytes" BIGINT NOT NULL,
    "backup_size_human" TEXT,
    "s3_bucket" TEXT,
    "s3_key" TEXT,
    "s3_url" TEXT,
    "checksum" TEXT,
    "zip_filename" TEXT NOT NULL,
    "exit_code" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "stdout_log" TEXT,
    "stderr_log" TEXT,
    "metadata" JSONB,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomaly_reason" TEXT,
    "retention_days" INTEGER,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_login_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_configs" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "hostname" TEXT,
    "is_monitored" BOOLEAN NOT NULL DEFAULT true,
    "mute_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "api_keys_server_id_idx" ON "api_keys"("server_id");

-- CreateIndex
CREATE INDEX "api_keys_project_name_idx" ON "api_keys"("project_name");

-- CreateIndex
CREATE INDEX "backup_reports_project_name_created_at_idx" ON "backup_reports"("project_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "backup_reports_server_id_created_at_idx" ON "backup_reports"("server_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "backup_reports_status_created_at_idx" ON "backup_reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "backup_reports_is_anomaly_created_at_idx" ON "backup_reports"("is_anomaly", "created_at" DESC);

-- CreateIndex
CREATE INDEX "backup_reports_expires_at_idx" ON "backup_reports"("expires_at");

-- CreateIndex
CREATE INDEX "backup_reports_created_at_idx" ON "backup_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_channel_created_at_idx" ON "notification_logs"("channel", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_status_created_at_idx" ON "notification_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "user_login_logs_username_created_at_idx" ON "user_login_logs"("username", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_login_logs_status_created_at_idx" ON "user_login_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_login_logs_created_at_idx" ON "user_login_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "server_configs_server_id_key" ON "server_configs"("server_id");

-- AddForeignKey
ALTER TABLE "user_login_logs" ADD CONSTRAINT "user_login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
