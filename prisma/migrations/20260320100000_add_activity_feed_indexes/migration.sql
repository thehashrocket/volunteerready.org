-- DropTransaction
-- CreateIndex CONCURRENTLY (cannot run inside transaction)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Shift_status_endTime_idx" ON "Shift"("status", "endTime");
