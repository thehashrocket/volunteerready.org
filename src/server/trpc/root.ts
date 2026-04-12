import { createTRPCRouter } from '@/server/trpc/init';
import { adminRouter } from '@/server/trpc/routers/admin';
import { analyticsRouter } from '@/server/trpc/routers/analytics';
import { authRouter } from '@/server/trpc/routers/auth';
import { backgroundChecksRouter } from '@/server/trpc/routers/background-checks';
import { billingRouter } from '@/server/trpc/routers/billing';
import { bulkImportRouter } from '@/server/trpc/routers/bulk-import';
import { caseStudyRouter } from '@/server/trpc/routers/case-study';
import { companyRouter } from '@/server/trpc/routers/company';
import { credentialSharingRouter } from '@/server/trpc/routers/credentialSharing';
import { credentialsRouter } from '@/server/trpc/routers/credentials';
import { discoveryRouter } from '@/server/trpc/routers/discovery';
import { esgReportRouter } from '@/server/trpc/routers/esg-report';
import { feedbackRouter } from '@/server/trpc/routers/feedback';
import { healthRouter } from '@/server/trpc/routers/health';
import { leadsRouter } from '@/server/trpc/routers/leads';
import { matchingRouter } from '@/server/trpc/routers/matching';
import { membersRouter } from '@/server/trpc/routers/members';
import { notificationsRouter } from '@/server/trpc/routers/notifications';
import { onboardingRouter } from '@/server/trpc/routers/onboarding';
import { opportunitiesRouter } from '@/server/trpc/routers/opportunities';
import { orgRouter } from '@/server/trpc/routers/org';
import { profileRouter } from '@/server/trpc/routers/profile';
import { screenerRouter } from '@/server/trpc/routers/screener';
import { shiftTemplatesRouter } from '@/server/trpc/routers/shift-templates';
import { shiftsRouter } from '@/server/trpc/routers/shifts';
import { statusRouter } from '@/server/trpc/routers/status';
import { volunteerRouter } from '@/server/trpc/routers/volunteer';

export const appRouter = createTRPCRouter({
	admin: adminRouter,
	analytics: analyticsRouter,
	auth: authRouter,
	backgroundChecks: backgroundChecksRouter,
	billing: billingRouter,
	bulkImport: bulkImportRouter,
	caseStudy: caseStudyRouter,
	company: companyRouter,
	credentialSharing: credentialSharingRouter,
	credentials: credentialsRouter,
	discovery: discoveryRouter,
	esgReport: esgReportRouter,
	feedback: feedbackRouter,
	health: healthRouter,
	leads: leadsRouter,
	matching: matchingRouter,
	members: membersRouter,
	notifications: notificationsRouter,
	onboarding: onboardingRouter,
	opportunities: opportunitiesRouter,
	org: orgRouter,
	profile: profileRouter,
	screener: screenerRouter,
	shiftTemplates: shiftTemplatesRouter,
	shifts: shiftsRouter,
	status: statusRouter,
	volunteer: volunteerRouter,
});

export type AppRouter = typeof appRouter;
