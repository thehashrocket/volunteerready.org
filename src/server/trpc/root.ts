import { createTRPCRouter } from '@/server/trpc/init';
import { authRouter } from '@/server/trpc/routers/auth';
import { backgroundChecksRouter } from '@/server/trpc/routers/background-checks';
import { billingRouter } from '@/server/trpc/routers/billing';
import { companyRouter } from '@/server/trpc/routers/company';
import { credentialSharingRouter } from '@/server/trpc/routers/credentialSharing';
import { credentialsRouter } from '@/server/trpc/routers/credentials';
import { healthRouter } from '@/server/trpc/routers/health';
import { matchingRouter } from '@/server/trpc/routers/matching';
import { membersRouter } from '@/server/trpc/routers/members';
import { onboardingRouter } from '@/server/trpc/routers/onboarding';
import { opportunitiesRouter } from '@/server/trpc/routers/opportunities';
import { orgRouter } from '@/server/trpc/routers/org';
import { profileRouter } from '@/server/trpc/routers/profile';
import { screenerRouter } from '@/server/trpc/routers/screener';
import { shiftsRouter } from '@/server/trpc/routers/shifts';
import { statusRouter } from '@/server/trpc/routers/status';

export const appRouter = createTRPCRouter({
	auth: authRouter,
	backgroundChecks: backgroundChecksRouter,
	billing: billingRouter,
	company: companyRouter,
	credentialSharing: credentialSharingRouter,
	credentials: credentialsRouter,
	health: healthRouter,
	matching: matchingRouter,
	members: membersRouter,
	onboarding: onboardingRouter,
	opportunities: opportunitiesRouter,
	org: orgRouter,
	profile: profileRouter,
	screener: screenerRouter,
	shifts: shiftsRouter,
	status: statusRouter,
});

export type AppRouter = typeof appRouter;
