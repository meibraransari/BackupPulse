-- CreateTable rsync_servers
CREATE TABLE "rsync_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL DEFAULT 'root',
    "auth_type" TEXT NOT NULL DEFAULT 'SSH_KEY',
    "password" TEXT,
    "ssh_private_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNTESTED',
    "last_checked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsync_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable rsync_repositories
CREATE TABLE "rsync_repositories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOCAL_DISK',
    "server_id" TEXT,
    "path" TEXT NOT NULL,
    "total_bytes" BIGINT,
    "used_bytes" BIGINT,
    "available_bytes" BIGINT,
    "is_mounted" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsync_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable rsync_jobs
CREATE TABLE "rsync_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_repo_id" TEXT NOT NULL,
    "source_subpath" TEXT,
    "dest_repo_id" TEXT NOT NULL,
    "dest_subpath" TEXT,
    "source_server_id" TEXT,
    "dest_server_id" TEXT,
    "sync_strategy" TEXT NOT NULL DEFAULT 'EXACT_MIRROR',
    "cron_schedule" TEXT,
    "bandwidth_limit_kb" INTEGER,
    "exclude_patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_args" TEXT,
    "preserve_permissions" BOOLEAN NOT NULL DEFAULT true,
    "preserve_owner" BOOLEAN NOT NULL DEFAULT true,
    "preserve_times" BOOLEAN NOT NULL DEFAULT true,
    "enable_compression" BOOLEAN NOT NULL DEFAULT false,
    "delete_extraneous" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_status" TEXT,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable rsync_runs
CREATE TABLE "rsync_runs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "run_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "source_path" TEXT NOT NULL,
    "destination_path" TEXT NOT NULL,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "transferred_files" INTEGER NOT NULL DEFAULT 0,
    "deleted_files" INTEGER NOT NULL DEFAULT 0,
    "bytes_transferred" BIGINT NOT NULL DEFAULT 0,
    "total_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "speedup_ratio" DOUBLE PRECISION,
    "duration_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exit_code" INTEGER,
    "stdout_log" TEXT,
    "stderr_log" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rsync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable rsync_activity_logs
CREATE TABLE "rsync_activity_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsync_activity_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes for rsync_servers
CREATE INDEX "rsync_servers_status_idx" ON "rsync_servers"("status");
CREATE INDEX "rsync_servers_created_at_idx" ON "rsync_servers"("created_at" DESC);

-- Indexes for rsync_repositories
CREATE INDEX "rsync_repositories_type_idx" ON "rsync_repositories"("type");
CREATE INDEX "rsync_repositories_server_id_idx" ON "rsync_repositories"("server_id");
CREATE INDEX "rsync_repositories_created_at_idx" ON "rsync_repositories"("created_at" DESC);

-- Indexes for rsync_jobs
CREATE INDEX "rsync_jobs_is_active_idx" ON "rsync_jobs"("is_active");
CREATE INDEX "rsync_jobs_last_run_status_idx" ON "rsync_jobs"("last_run_status");
CREATE INDEX "rsync_jobs_created_at_idx" ON "rsync_jobs"("created_at" DESC);

-- Indexes for rsync_runs
CREATE INDEX "rsync_runs_job_id_started_at_idx" ON "rsync_runs"("job_id", "started_at" DESC);
CREATE INDEX "rsync_runs_status_started_at_idx" ON "rsync_runs"("status", "started_at" DESC);
CREATE INDEX "rsync_runs_started_at_idx" ON "rsync_runs"("started_at" DESC);

-- Indexes for rsync_activity_logs
CREATE INDEX "rsync_activity_logs_action_created_at_idx" ON "rsync_activity_logs"("action", "created_at" DESC);
CREATE INDEX "rsync_activity_logs_entity_type_created_at_idx" ON "rsync_activity_logs"("entity_type", "created_at" DESC);
CREATE INDEX "rsync_activity_logs_created_at_idx" ON "rsync_activity_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "rsync_repositories" ADD CONSTRAINT "rsync_repositories_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "rsync_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsync_jobs" ADD CONSTRAINT "rsync_jobs_source_repo_id_fkey" FOREIGN KEY ("source_repo_id") REFERENCES "rsync_repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsync_jobs" ADD CONSTRAINT "rsync_jobs_dest_repo_id_fkey" FOREIGN KEY ("dest_repo_id") REFERENCES "rsync_repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsync_jobs" ADD CONSTRAINT "rsync_jobs_source_server_id_fkey" FOREIGN KEY ("source_server_id") REFERENCES "rsync_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsync_jobs" ADD CONSTRAINT "rsync_jobs_dest_server_id_fkey" FOREIGN KEY ("dest_server_id") REFERENCES "rsync_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsync_runs" ADD CONSTRAINT "rsync_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "rsync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
