-- Remediate cross-org `opportunityId` references on Shift and ShiftTemplate.
--
-- HAND-WRITTEN. schema.prisma does NOT change — this is a data fix, not a
-- structural one, so `migrate diff` generates nothing for it.
--
-- WHY A DATA MIGRATION AND NOT JUST THE CODE GUARD
-- -----------------------------------------------
-- `requireOrgOpportunity` (shiftAccessService.ts) now blocks NEW cross-org
-- links on all four write paths: shift create/update and template
-- create/update. It does nothing about rows written before it landed — and the
-- hole it closes was live, so such rows may exist.
--
-- They keep leaking without any further write. `listShiftsByOrg`,
-- `getShiftWithSignups`, `listUpcomingShiftsForOrg` and `listTemplatesByOrg`
-- all `include: { opportunity: { select: { id, title } } }`, so a stale row
-- surfaces the foreign org's opportunity title through a list that is
-- correctly scoped to the caller's own org. Worse for templates:
-- `generateShiftsFromTemplate` copies `opportunityId` onto every Shift it
-- creates, so one stale template keeps minting new leaking rows long after the
-- guard is in place.
--
-- WHY NULL AND NOT A REASSIGNMENT
-- -------------------------------
-- `opportunityId` is already nullable on both tables and is presentation-only
-- (a label on the shift, plus `listShiftsByOpportunity` grouping). There is no
-- correct org-local opportunity to point these at — the link was never
-- legitimate — so unlinking is the only truthful repair. Nulling it destroys
-- no volunteer-facing data: signups, attendance and audit rows are untouched.
--
-- Expected to affect ZERO rows on any instance where the hole was never
-- exploited. It is written to be safe and idempotent either way, so it can be
-- re-run without effect.

UPDATE "Shift" s
SET "opportunityId" = NULL
FROM "VolunteerOpportunity" o
WHERE s."opportunityId" = o."id"
  AND s."orgId" <> o."orgId";

UPDATE "ShiftTemplate" t
SET "opportunityId" = NULL
FROM "VolunteerOpportunity" o
WHERE t."opportunityId" = o."id"
  AND t."orgId" <> o."orgId";
