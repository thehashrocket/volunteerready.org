-- Add index to UserMarketplacePreference for digest cron query
CREATE INDEX IF NOT EXISTS "UserMarketplacePreference_digestFrequency_lastDigestSentAt_idx"
  ON "UserMarketplacePreference"("digestFrequency", "lastDigestSentAt");

-- Add composite index to VolunteerOpportunity for marketplace opportunity listing
CREATE INDEX IF NOT EXISTS "VolunteerOpportunity_status_createdAt_idx"
  ON "VolunteerOpportunity"("status", "createdAt");
