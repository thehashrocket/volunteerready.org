import { z } from 'zod';
import {
	endImpersonationSchema,
	IMPERSONATION_MAX_DURATION_MS,
	startImpersonationSchema,
} from '@/server/domain/impersonation';
import {
	getAuditFilterOptions,
	queryAudit,
} from '@/server/services/auditQueryService';
import {
	listOrgFeatureFlags,
	setFeatureFlag,
} from '@/server/services/featureFlagService';
import {
	endImpersonation,
	getCurrentImpersonation,
	listImpersonationHistory,
	startImpersonation,
} from '@/server/services/impersonationService';
import { listDelinquentOrgs } from '@/server/services/platformBillingService';
import {
	getOrg,
	listOrgs,
	suspendOrg,
	unsuspendOrg,
} from '@/server/services/platformOrgService';
import {
	getUser,
	listUsers,
	revokeAllSessions,
	setPlatformAdmin,
} from '@/server/services/platformUserService';
import {
	createTRPCRouter,
	platformAdminProcedure,
	requireRealUserId,
} from '@/server/trpc/init';

const listInputSchema = z.object({
	search: z.string().optional(),
	cursor: z.string().nullable().optional(),
	limit: z.number().int().min(1).max(100).optional(),
});

const idInputSchema = z.object({ id: z.string().cuid() });

const auditQuerySchema = z.object({
	filters: z
		.object({
			actorId: z.string().optional().nullable(),
			subjectId: z.string().optional().nullable(),
			entityType: z.string().optional().nullable(),
			entityId: z.string().optional().nullable(),
			action: z.string().optional().nullable(),
			orgId: z.string().optional().nullable(),
			dateFrom: z.date().optional().nullable(),
			dateTo: z.date().optional().nullable(),
			impersonatedOnly: z.boolean().optional(),
		})
		.optional()
		.default({}),
	cursor: z.string().nullable().optional(),
	limit: z.number().int().min(1).max(200).optional(),
});

export const platformAdminRouter = createTRPCRouter({
	orgs: createTRPCRouter({
		list: platformAdminProcedure
			.input(listInputSchema.optional())
			.query(async ({ input }) => {
				return listOrgs(input ?? {});
			}),
		get: platformAdminProcedure
			.input(idInputSchema)
			.query(async ({ input }) => {
				return getOrg(input.id);
			}),
		suspend: platformAdminProcedure
			.input(
				z.object({
					id: z.string().cuid(),
					reason: z.string().min(10).max(500),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorId = requireRealUserId(ctx);
				return suspendOrg({ ...input, actorId });
			}),
		unsuspend: platformAdminProcedure
			.input(
				z.object({
					id: z.string().cuid(),
					reason: z.string().min(5).max(500),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorId = requireRealUserId(ctx);
				return unsuspendOrg({ ...input, actorId });
			}),
	}),
	billing: createTRPCRouter({
		delinquent: platformAdminProcedure
			.input(
				z
					.object({ limit: z.number().int().min(1).max(500).optional() })
					.optional(),
			)
			.query(async ({ input }) => {
				return listDelinquentOrgs({ limit: input?.limit });
			}),
	}),
	flags: createTRPCRouter({
		list: platformAdminProcedure
			.input(z.object({ orgId: z.string().cuid() }))
			.query(async ({ input }) => {
				return listOrgFeatureFlags(input.orgId);
			}),
		set: platformAdminProcedure
			.input(
				z.object({
					orgId: z.string().cuid(),
					key: z.string().min(1).max(100),
					enabled: z.boolean(),
					reason: z.string().min(5).max(500),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorId = requireRealUserId(ctx);
				return setFeatureFlag({ ...input, actorId });
			}),
	}),
	users: createTRPCRouter({
		list: platformAdminProcedure
			.input(listInputSchema.optional())
			.query(async ({ input }) => {
				return listUsers(input ?? {});
			}),
		get: platformAdminProcedure
			.input(idInputSchema)
			.query(async ({ input }) => {
				return getUser(input.id);
			}),
		setPlatformAdmin: platformAdminProcedure
			.input(
				z.object({
					id: z.string().cuid(),
					value: z.boolean(),
					reason: z.string().min(5).max(500),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorId = requireRealUserId(ctx);
				return setPlatformAdmin({ ...input, actorId });
			}),
		revokeAllSessions: platformAdminProcedure
			.input(
				z.object({
					id: z.string().cuid(),
					reason: z.string().min(5).max(500),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorId = requireRealUserId(ctx);
				return revokeAllSessions({ ...input, actorId });
			}),
	}),
	impersonation: createTRPCRouter({
		start: platformAdminProcedure
			.input(startImpersonationSchema)
			.mutation(async ({ ctx, input }) => {
				const adminId = requireRealUserId(ctx);
				const result = await startImpersonation(
					adminId,
					input.targetId,
					input.reason,
				);
				return {
					sessionId: result.sessionId,
					expiresAt: result.expiresAt,
					maxDurationMs: IMPERSONATION_MAX_DURATION_MS,
				};
			}),
		end: platformAdminProcedure
			.input(endImpersonationSchema)
			.mutation(async ({ ctx, input }) => {
				const adminId = requireRealUserId(ctx);
				if (!input.sessionId) {
					return { ok: true as const, alreadyEnded: true };
				}
				return endImpersonation(input.sessionId, adminId, 'manual');
			}),
		current: platformAdminProcedure
			.input(z.object({ sessionId: z.string().cuid() }).optional())
			.query(async ({ input }) => {
				if (!input?.sessionId) return null;
				return getCurrentImpersonation(input.sessionId);
			}),
		history: platformAdminProcedure
			.input(
				z.object({
					adminUserId: z.string().cuid().optional(),
					targetUserId: z.string().cuid().optional(),
					limit: z.number().int().min(1).max(200).optional(),
				}),
			)
			.query(async ({ input }) => {
				return listImpersonationHistory(input);
			}),
	}),
	audit: createTRPCRouter({
		query: platformAdminProcedure
			.input(auditQuerySchema)
			.query(async ({ input }) => {
				return queryAudit(input.filters, {
					cursor: input.cursor,
					limit: input.limit,
				});
			}),
		options: platformAdminProcedure.query(async () => {
			return getAuditFilterOptions();
		}),
	}),
});
