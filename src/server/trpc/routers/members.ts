import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Role } from '@/prisma/generated/client';
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from '@/server/trpc/init';
import {
	inviteMember,
	getInvitationDetails,
	acceptInvitation,
	listOrgMembers,
	removeOrgMember,
	updateOrgMemberRole,
} from '@/server/services/memberService';

export const membersRouter = createTRPCRouter({
	// List members in the current org
	list: adminProcedure.query(async ({ ctx }) => {
		return listOrgMembers(ctx.orgId!);
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
			// ADMIN can only invite STAFF or READONLY; OWNER can invite ADMIN
			if (ctx.role === Role.ADMIN && input.role === 'ADMIN') {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message:
						'Admins can only invite Staff or Read-only members.',
				});
			}
			const baseUrl =
				process.env.NEXT_PUBLIC_APP_URL ??
				process.env.NEXTAUTH_URL ??
				'http://localhost:3000';
			return inviteMember(
				ctx.orgId!,
				input.email,
				input.role as Role,
				baseUrl,
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
				details.usedAt !== null ||
				details.expiresAt < new Date();

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
			const userId = ctx.session!.user!.id;
			const userEmail = ctx.session!.user?.email ?? '';
			if (!userEmail) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Your account has no email address.',
				});
			}
			return acceptInvitation(input.token, userId, userEmail);
		}),

	// Remove a member from the org
	removeMember: adminProcedure
		.input(z.object({ memberId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const actingUserId = ctx.session!.user!.id;
			return removeOrgMember(
				ctx.orgId!,
				actingUserId,
				input.memberId,
			);
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
			const actingUserId = ctx.session!.user!.id;
			return updateOrgMemberRole(
				ctx.orgId!,
				actingUserId,
				input.memberId,
				input.role as Role,
			);
		}),
});
