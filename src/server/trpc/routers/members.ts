import { z } from 'zod';
import type { Role } from '@/prisma/generated/client';
import {
	acceptInvitation,
	getInvitationDetails,
	inviteMember,
	listOrgMembers,
	removeOrgMember,
	updateOrgMemberRole,
} from '@/server/services/memberService';
import { effectiveUserId } from '@/server/trpc/audit-actor';
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from '@/server/trpc/init';

export const membersRouter = createTRPCRouter({
	// List members in the current org
	list: adminProcedure.query(async ({ ctx }) => {
		return listOrgMembers(ctx.orgId);
	}),

	// Send invitation email
	invite: adminProcedure
		.input(
			z.object({
				email: z.string().email(),
				role: z.enum(['ADMIN', 'STAFF', 'READONLY']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const baseUrl =
				process.env.NEXT_PUBLIC_APP_URL ??
				process.env.NEXTAUTH_URL ??
				'http://localhost:3000';
			// No `ctx.role` argument: the service resolves the acting role from the
			// database itself. The optional parameter it replaced failed open when
			// omitted, and `ctx.role` is null on the impersonation branch of
			// `createTRPCContext` before it is re-resolved.
			return inviteMember(
				ctx.orgId,
				input.email,
				input.role as Role,
				baseUrl,
				ctx.session?.user?.id ?? '',
			);
		}),

	// Public: get invitation display info (org name, masked email, role)
	getInvitation: publicProcedure
		.input(z.object({ token: z.string().min(1) }))
		.query(async ({ input }) => {
			const details = await getInvitationDetails(input.token);
			if (!details) return null;

			const [local, domain] = details.email.split('@');
			const maskedLocal = local
				? `${local[0]}${'*'.repeat(Math.min(local.length - 1, 4))}`
				: '***';
			const maskedEmail = `${maskedLocal}@${domain}`;

			const isExpired =
				details.usedAt !== null || details.expiresAt < new Date();

			return {
				orgName: details.organization.name,
				role: details.role,
				maskedEmail,
				isExpired,
			};
		}),

	// Accept an invitation (must be logged in with matching email)
	accept: protectedProcedure
		.input(z.object({ token: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			// Id only — the service resolves the address from this same id. Passing
			// `ctx.session.user.email` alongside it mixed two identities under
			// impersonation; see the note on `acceptInvitation`.
			return acceptInvitation(input.token, effectiveUserId(ctx) ?? '');
		}),

	// Remove a member from the org
	removeMember: adminProcedure
		.input(z.object({ memberId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const actingUserId = ctx.session?.user?.id ?? '';
			return removeOrgMember(ctx.orgId, actingUserId, input.memberId);
		}),

	// Change a member's role
	updateRole: adminProcedure
		.input(
			z.object({
				memberId: z.string().min(1),
				role: z.enum(['ADMIN', 'STAFF', 'READONLY']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const actingUserId = ctx.session?.user?.id ?? '';
			return updateOrgMemberRole(
				ctx.orgId,
				actingUserId,
				input.memberId,
				input.role as Role,
			);
		}),
});
