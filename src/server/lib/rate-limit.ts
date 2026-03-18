/**
 * Upstash Redis rate limiter singleton.
 *
 * Follows the same lazy-init pattern as resend.ts.
 * When UPSTASH_REDIS_REST_URL is not set (local dev), rate limiting
 * is disabled (fail-open) so no Redis setup is required to run pnpm dev.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type RateLimitConfig = {
	/** Max requests allowed in the window. */
	limit: number;
	/** Window size in seconds. */
	windowSeconds: number;
	/** Human-readable prefix for Redis keys (e.g., 'discovery:search'). */
	prefix: string;
};

export type RateLimitResult = {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
};

let _redis: Redis | null = null;
const _limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
	if (_redis) return _redis;
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	_redis = new Redis({ url, token });
	return _redis;
}

/**
 * Returns a cached Ratelimit instance for the given config.
 * Returns null if Redis is not configured.
 */
export function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
	const redis = getRedis();
	if (!redis) return null;

	const cacheKey = `${config.prefix}:${config.limit}:${config.windowSeconds}`;
	const cached = _limiters.get(cacheKey);
	if (cached) return cached;

	const limiter = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
		prefix: config.prefix,
	});
	_limiters.set(cacheKey, limiter);
	return limiter;
}

/**
 * Check rate limit for the given identifier. Fails open on error
 * (Redis down, missing config) so a Redis outage never blocks users.
 */
export async function checkRateLimit(
	config: RateLimitConfig,
	identifier: string,
): Promise<RateLimitResult> {
	const passthrough: RateLimitResult = {
		success: true,
		limit: 0,
		remaining: 0,
		reset: 0,
	};

	const limiter = getRateLimiter(config);
	if (!limiter) return passthrough;

	try {
		const result = await limiter.limit(identifier);
		return {
			success: result.success,
			limit: result.limit,
			remaining: result.remaining,
			reset: result.reset,
		};
	} catch (err) {
		console.error('[rate-limit] Redis error, failing open:', err);
		return passthrough;
	}
}
