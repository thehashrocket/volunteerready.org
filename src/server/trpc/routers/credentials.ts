import { z } from 'zod';
import {
	getMyCredentials,
	getOrgCredentials,
	issueCredential,
	removeCredential,
	revokeCredential,
} from '@/server/services/volunteerCredentialService';
import {
	createTRPCRouter,
	protectedProcedure,
	requireUserId,
	staffProcedure,
} from '@/server/trpc/init';

const credentialTypeEnum = z.enum([
	'BACKGROUND_CHECK',
	'TRAINING_COMPLETE',
	'ID_VERIFIED',
	'REFERENCE_CHECK',
	'ORIENTATION_COMPLETE',
]);

const credentialStatusEnum = z.enum([
	'PENDING',
	'VERIFIED',
	'EXPIRED',
	'REVOKED',
]);

export const credentialsRouter = createTRPCRouter({
	// ----- Volunteer-facing -----

	/** Get all my credentials across orgs. */
	getMyCredentials: protectedProcedure.query(({ ctx }) =>
		getMyCredentials(requireUserId(ctx.session)),
	),

	// ----- Staff-facing (org-scoped) -----

	/** List all credentials in the current org. */
	listOrgCredentials: staffProcedure.query(({ ctx }) =>
		getOrgCredentials(ctx.orgId),
	),

	/** Issue or update a credential for a volunteer. */
	issue: staffProcedure
		.input(
			z.object({
				userId: z.string().min(1),
				type: credentialTypeEnum,
				status: credentialStatusEnum,
				issuedAt: z.coerce.date().nullable().optional(),
				expiresAt: z.coerce.date().nullable().optional(),
				notes: z.string().max(500).nullable().optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			issueCredential(
				{
					userId: input.userId,
					orgId: ctx.orgId,
					type: input.type,
					status: input.status,
					issuedAt: input.issuedAt,
					expiresAt: input.expiresAt,
					notes: input.notes,
				},
				requireUserId(ctx.session),
			),
		),

	/** Revoke a credential. */
	revoke: staffProcedure
		.input(
			z.object({
				userId: z.string().min(1),
				type: credentialTypeEnum,
			}),
		)
		.mutation(({ ctx, input }) =>
			revokeCredential(
				input.userId,
				ctx.orgId,
				input.type,
				requireUserId(ctx.session),
			),
		),

	/** Remove a credential entirely. */
	remove: staffProcedure
		.input(
			z.object({
				userId: z.string().min(1),
				type: credentialTypeEnum,
			}),
		)
		.mutation(({ ctx, input }) =>
			removeCredential(
				input.userId,
				ctx.orgId,
				input.type,
				requireUserId(ctx.session),
			),
		),
});
