import {
	claimShareTokenSchema,
	generateShareTokenSchema,
	getTokenInfoSchema,
	requestCredentialSharingSchema,
	revokeShareTokenSchema,
} from '@/server/domain/credential-sharing';
import {
	claimShareToken,
	generateShareToken,
	getExternalCredentialCount,
	getMyShareTokens,
	getShareCount,
	getTokenInfo,
	requestCredentialSharing,
	revokeShareToken,
} from '@/server/services/credentialShareService';
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
	requireUserId,
	staffProcedure,
} from '@/server/trpc/init';
import {
	rateLimitByIp,
	rateLimitByOrg,
	rateLimitByUser,
} from '@/server/trpc/rate-limit-middleware';

export const credentialSharingRouter = createTRPCRouter({
	/** Volunteer generates a share link for a VERIFIED credential. */
	generate: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 5,
				windowSeconds: 60,
				prefix: 'credential:generate',
			}),
		)
		.input(generateShareTokenSchema)
		.mutation(async ({ ctx, input }) => {
			return generateShareToken(input.credentialId, requireUserId(ctx.session));
		}),

	/** Volunteer lists their share tokens. */
	listMyTokens: protectedProcedure.query(async ({ ctx }) => {
		return getMyShareTokens(requireUserId(ctx.session));
	}),

	/** Volunteer revokes an active share token. */
	revoke: protectedProcedure
		.input(revokeShareTokenSchema)
		.mutation(async ({ ctx, input }) => {
			return revokeShareToken(input.tokenId, requireUserId(ctx.session));
		}),

	/** Public preview of a share token — credential type + org name only. */
	getTokenInfo: publicProcedure
		.use(
			rateLimitByIp({
				limit: 30,
				windowSeconds: 60,
				prefix: 'credential:token-info',
			}),
		)
		.input(getTokenInfoSchema)
		.query(async ({ input }) => {
			return getTokenInfo(input.token);
		}),

	/** Staff claims a shared credential into their organization. */
	claim: staffProcedure
		.use(
			rateLimitByOrg({
				limit: 10,
				windowSeconds: 60,
				prefix: 'credential:claim',
			}),
		)
		.input(claimShareTokenSchema)
		.mutation(async ({ ctx, input }) => {
			return claimShareToken(
				input.token,
				ctx.orgId,
				requireUserId(ctx.session),
			);
		}),

	/** Get share count for a specific credential. */
	shareCount: protectedProcedure
		.input(generateShareTokenSchema) // reuses credentialId schema
		.query(async ({ input }) => {
			return getShareCount(input.credentialId);
		}),

	/** Count verified credentials a volunteer has at other orgs (for staff). */
	externalCredentialCount: staffProcedure
		.input(requestCredentialSharingSchema) // uses applicationId
		.query(async ({ ctx, input }) => {
			// Look up the application to get the volunteer's userId
			const { prisma } = await import('@/server/repositories/prisma');
			const app = await prisma.volunteerApplication.findFirst({
				where: { id: input.applicationId, orgId: ctx.orgId },
				select: { submittedByUserId: true },
			});
			if (!app?.submittedByUserId) return { count: 0 };
			const count = await getExternalCredentialCount(
				app.submittedByUserId,
				ctx.orgId,
			);
			return { count };
		}),

	/** Staff requests a volunteer to share their credentials. */
	requestSharing: staffProcedure
		.input(requestCredentialSharingSchema)
		.mutation(async ({ ctx, input }) => {
			const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? '';
			return requestCredentialSharing({
				applicationId: input.applicationId,
				orgId: ctx.orgId,
				actorId: requireUserId(ctx.session),
				baseUrl,
			});
		}),
});
