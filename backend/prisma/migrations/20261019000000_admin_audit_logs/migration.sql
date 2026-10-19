-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT NOT NULL,
    "user_role" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target_resource" TEXT,
    "details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_category_created_at_idx" ON "admin_audit_logs"("category", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_username_created_at_idx" ON "admin_audit_logs"("username", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);
