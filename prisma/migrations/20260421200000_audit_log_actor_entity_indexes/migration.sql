-- Add indexes to AuditLog for bidirectional subject queries.
-- CONCURRENTLY avoids table locks on production tables.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
