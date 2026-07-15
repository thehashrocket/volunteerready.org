import { z } from 'zod';
import {
	createCompanySchema,
	linkNonprofitSchema,
	switchCompanySchema,
} from '@/server/domain/billing';
import {
	findCompanyById,
	listCompaniesForUser,
	listLinkedNonprofits,
} from '@/server/repositories/companyRepo';
import {
	acceptCompanyInvite,
	createCompany,
	inviteCompanyMember,
	linkNonprofit,
	switchCompanyForSession,
	unlinkNonprofit,
} from '@/server/services/companyService';
import {
	companyScopedProcedure,
	createTRPCRouter,
	protectedProcedure,
} from '../init';

export const companyRouter = createTRPCRouter({
	/** Create a new company and become its OWNER. */
	create: protectedProcedure
		.input(createCompanySchema)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.sessionToken) {
				throw new Error('No session token');
			}
			return createCompany({
				name: input.name,
				userId: ctx.session?.user?.id ?? '',
				sessionToken: ctx.sessionToken,
			});
		}),

	/** List all companies the current user belongs to. */
	listMyCompanies: protectedProcedure.query(async ({ ctx }) => {
		return listCompaniesForUser(ctx.session?.user?.id ?? '');
	}),

	/** Switch the session's active company context. */
	switchCompany: protectedProcedure
		.input(switchCompanySchema)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.sessionToken) {
				throw new Error('No session token');
			}
			return switchCompanyForSession({
				userId: ctx.session?.user?.id ?? '',
				sessionToken: ctx.sessionToken,
				targetCompanyId: input.companyId,
			});
		}),

	/** Get a company by id (requires membership in that company). */
	getCurrent: companyScopedProcedure().query(async ({ ctx }) => {
		return findCompanyById(ctx.companyId);
	}),

	/** Link a nonprofit to the company (admin only). */
	linkNonprofit: companyScopedProcedure({ minRole: 'ADMIN' })
		.input(linkNonprofitSchema)
		.mutation(async ({ ctx, input }) => {
			return linkNonprofit({
				companyId: ctx.companyId,
				orgId: input.orgId,
				actorId: ctx.session?.user?.id ?? '',
			});
		}),

	/** Unlink a nonprofit from the company (admin only). */
	unlinkNonprofit: companyScopedProcedure({ minRole: 'ADMIN' })
		.input(linkNonprofitSchema)
		.mutation(async ({ ctx, input }) => {
			return unlinkNonprofit({
				companyId: ctx.companyId,
				orgId: input.orgId,
				actorId: ctx.session?.user?.id ?? '',
			});
		}),

	/** List nonprofits actively linked to the company. */
	listLinkedNonprofits: companyScopedProcedure().query(async ({ ctx }) => {
		return listLinkedNonprofits(ctx.companyId);
	}),

	/** Invite a member to the company (admin only). */
	invite: companyScopedProcedure({ minRole: 'ADMIN' })
		.input(
			z.object({
				email: z.string().email(),
				role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
			return inviteCompanyMember({
				companyId: ctx.companyId,
				email: input.email,
				role: input.role,
				actorId: ctx.session?.user?.id ?? '',
				baseUrl,
			});
		}),

	/** Accept a company invitation by raw token (public — called after login). */
	acceptInvite: protectedProcedure
		.input(z.object({ token: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { hashToken } = await import('@/server/lib/tokens');
			const tokenHash = hashToken(input.token);
			return acceptCompanyInvite({
				tokenHash,
				userId: ctx.session?.user?.id ?? '',
				userEmail: ctx.session?.user?.email ?? '',
			});
		}),
});
