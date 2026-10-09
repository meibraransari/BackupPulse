-- AlterTable users
ALTER TABLE "users" ADD COLUMN "assigned_projects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable backup_reports
ALTER TABLE "backup_reports" ADD COLUMN "restore_drill_status" TEXT;
ALTER TABLE "backup_reports" ADD COLUMN "restore_drill_duration_seconds" INTEGER;
ALTER TABLE "backup_reports" ADD COLUMN "restore_drill_verified_tables" INTEGER;
ALTER TABLE "backup_reports" ADD COLUMN "restore_drill_log" TEXT;

-- CreateIndex
CREATE INDEX "backup_reports_restore_drill_status_idx" ON "backup_reports"("restore_drill_status");
