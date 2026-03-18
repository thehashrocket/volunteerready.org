/**
 * tRPC rate limiting middleware factories.
 *
 * Three factories matching the three key-identifier patterns:
 * - rateLimitByOrg: uses ctx.orgId (for staffProcedure / orgProcedure chains)
 * - rateLimitByUser: uses ctx.session.user.id (for protectedProcedure chains)
 * - rateLimitByIp: uses ctx.ip (for publicProcedure chains)
 *
 * Usage: `staffProcedure.use(rateLimitByOrg({ limit: 60, windowSeconds: 60, prefix: 'discovery:search' }))`
 */

import { TRPCError } from '@trpc/server';
import { checkRateLimit, type RateLimitConfig } from '@/server/lib/rate-limit';
import { t } from '@/server/trpc/init';

/**
 * Rate limit by organization ID. Requires ctx.orgId (narrowed by orgProcedure/staffProcedure).
 */
export function rateLimitByOrg(config: RateLimitConfig) {
	return t.middleware(async ({ ctx, next }) => {
		const orgId = (ctx as { orgId?: string }).orgId;
		if (!orgId) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Missing orgId for rate limiting.',
			});
		}
		const result = await checkRateLimit(config, orgId);
		if (!result.success) {
			console.warn(`[rate-limit] Blocked: ${config.prefix} org=${orgId}`);
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: `Rate limit exceeded. Try again after ${new Date(result.reset).toISOString()}.`,
			});
		}
		return next();
	});
}

/**
 * Rate limit by authenticated user ID. Requires ctx.session.user.id (narrowed by protectedProcedure).
 */
export function rateLimitByUser(config: RateLimitConfig) {
	return t.middleware(async ({ ctx, next }) => {
		const userId = (ctx as { session?: { user?: { id?: string } } | null })
			.session?.user?.id;
		if (!userId) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Missing userId for rate limiting.',
			});
		}
		const result = await checkRateLimit(config, userId);
		if (!result.success) {
			console.warn(`[rate-limit] Blocked: ${config.prefix} user=${userId}`);
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: `Rate limit exceeded. Try again after ${new Date(result.reset).toISOString()}.`,
			});
		}
		return next();
	});
}

/**
 * Rate limit by client IP address. Uses ctx.ip from createTRPCContext.
 * Falls back to 'unknown' if IP is not available (all unknown-IP traffic shares one bucket).
 */
export function rateLimitByIp(config: RateLimitConfig) {
	return t.middleware(async ({ ctx, next }) => {
		const ip = (ctx as { ip?: string | null }).ip ?? 'unknown';
		const result = await checkRateLimit(config, ip);
		if (!result.success) {
			console.warn(`[rate-limit] Blocked: ${config.prefix} ip=${ip}`);
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: `Rate limit exceeded. Try again after ${new Date(result.reset).toISOString()}.`,
			});
		}
		return next();
	});
}
