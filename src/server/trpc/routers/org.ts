import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { updateMarketplaceSettings } from '@/server/services/orgMarketplaceService';
import { switchOrgForSession } from '@/server/services/orgService';
import {
	createTRPCRouter,
	orgProcedure,
	protectedProcedure,
	staffProcedure,
} from '@/server/trpc/init';

export const orgRouter = createTRPCRouter({
	getCurrentOrg: orgProcedure.query(async ({ ctx }) => {
		const orgId = ctx.orgId;
		if (!orgId) {
			throw new TRPCError({ code: 'FORBIDDEN' });
		}
		return ctx.prisma.organization.findUnique({
			where: { id: orgId },
		});
	}),
	listOrgs: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session?.user?.id;
		if (!userId) {
			throw new TRPCError({ code: 'UNAUTHORIZED' });
		}
		const memberships = await ctx.prisma.organizationMember.findMany({
			where: { userId },
			include: { organization: true },
		});

		return memberships.map((membership) => membership.organization);
	}),
	switchOrg: protectedProcedure
		.input(z.object({ orgId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new TRPCError({ code: 'UNAUTHORIZED' });
			}

			// We need the session token to update the DB Session row.
			const sessionToken = ctx.sessionToken;
			if (!sessionToken) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Missing session token in tRPC context.',
				});
			}

			return switchOrgForSession({
				userId,
				sessionToken,
				targetOrgId: input.orgId,
			});
		}),

	/** Update org QR foreground color (staff only). */
	updateQrColor: staffProcedure
		.input(
			z.object({
				qrForegroundColor: z
					.string()
					.regex(
						/^#[0-9a-fA-F]{6}$/,
						'Must be a valid hex color (e.g. #1B3C2A)',
					)
					.nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Validate contrast against white background (WCAG AA: >= 3:1 for large text)
			if (input.qrForegroundColor) {
				const hex = input.qrForegroundColor.replace('#', '');
				const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
				const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
				const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
				const luminance = (c: number) =>
					c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
				const L =
					0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);
				// White bg luminance = 1.0. Contrast ratio = (lighter + 0.05) / (darker + 0.05)
				const contrast = (1.0 + 0.05) / (L + 0.05);
				if (contrast < 3) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message:
							'Color has insufficient contrast against white background. Choose a darker color.',
					});
				}
			}

			return ctx.prisma.organization.update({
				where: { id: ctx.orgId },
				data: { qrForegroundColor: input.qrForegroundColor },
			});
		}),

	/** Update org timezone (staff only). */
	updateTimezone: staffProcedure
		.input(
			z.object({
				timezone: z
					.string()
					.refine(
						(tz) => {
							try {
								Intl.DateTimeFormat(undefined, { timeZone: tz });
								return true;
							} catch {
								return false;
							}
						},
						{ message: 'Invalid IANA timezone string' },
					)
					.nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.organization.update({
				where: { id: ctx.orgId },
				data: { timezone: input.timezone },
			});
		}),

	/** Update org marketplace visibility and profile fields (staff only). */
	updateMarketplaceSettings: staffProcedure
		.input(
			z.object({
				marketplaceVisible: z.boolean().optional(),
				description: z.string().max(500).nullish(),
				location: z.string().max(100).nullish(),
				causeAreaTags: z.array(z.string().max(50)).max(10).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await updateMarketplaceSettings(ctx.orgId, input);
		}),
});
