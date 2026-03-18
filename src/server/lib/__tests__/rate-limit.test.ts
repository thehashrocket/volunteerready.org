import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @upstash/ratelimit and @upstash/redis with proper class constructors
// ---------------------------------------------------------------------------

const mockLimit = vi.fn();

vi.mock('@upstash/ratelimit', () => {
	class MockRatelimit {
		limit = mockLimit;
		static slidingWindow = vi.fn().mockReturnValue('sliding-window-config');
	}
	return { Ratelimit: MockRatelimit };
});

vi.mock('@upstash/redis', () => {
	class MockRedis {
		_mock = true;
	}
	return { Redis: MockRedis };
});

// ---------------------------------------------------------------------------
// We need to reset module state between groups because rate-limit.ts uses
// module-level singletons (_redis, _limiters). vi.resetModules() + dynamic
// import gives us a fresh module each time.
// ---------------------------------------------------------------------------

const config = { limit: 10, windowSeconds: 60, prefix: 'test:endpoint' };

describe('rate-limit lib', () => {
	afterEach(() => {
		delete process.env.UPSTASH_REDIS_REST_URL;
		delete process.env.UPSTASH_REDIS_REST_TOKEN;
		vi.clearAllMocks();
	});

	describe('checkRateLimit — no Redis configured', () => {
		beforeEach(() => {
			vi.resetModules();
			delete process.env.UPSTASH_REDIS_REST_URL;
			delete process.env.UPSTASH_REDIS_REST_TOKEN;
		});

		it('returns passthrough (success=true) when env vars are missing', async () => {
			const { checkRateLimit } = await import('@/server/lib/rate-limit');
			const result = await checkRateLimit(config, 'any-id');
			expect(result.success).toBe(true);
			expect(result.limit).toBe(0);
			expect(result.remaining).toBe(0);
		});
	});

	describe('checkRateLimit — Redis configured', () => {
		beforeEach(() => {
			vi.resetModules();
			process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
			process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
		});

		it('returns success result when under limit', async () => {
			mockLimit.mockResolvedValueOnce({
				success: true,
				limit: 10,
				remaining: 9,
				reset: 1234567890,
			});

			const { checkRateLimit } = await import('@/server/lib/rate-limit');
			const result = await checkRateLimit(config, 'org-123');

			expect(result).toEqual({
				success: true,
				limit: 10,
				remaining: 9,
				reset: 1234567890,
			});
			expect(mockLimit).toHaveBeenCalledWith('org-123');
		});

		it('returns blocked result when over limit', async () => {
			mockLimit.mockResolvedValueOnce({
				success: false,
				limit: 10,
				remaining: 0,
				reset: 9999999999,
			});

			const { checkRateLimit } = await import('@/server/lib/rate-limit');
			const result = await checkRateLimit(config, 'org-123');

			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it('fails open (success=true) when Redis throws a connection error', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			mockLimit.mockRejectedValueOnce(new Error('Redis connection refused'));

			const { checkRateLimit } = await import('@/server/lib/rate-limit');
			const result = await checkRateLimit(config, 'org-123');

			expect(result.success).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith(
				'[rate-limit] Redis error, failing open:',
				expect.any(Error),
			);

			consoleSpy.mockRestore();
		});

		it('fails open (success=true) when Redis times out', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			mockLimit.mockRejectedValueOnce(new Error('Request timed out'));

			const { checkRateLimit } = await import('@/server/lib/rate-limit');
			const result = await checkRateLimit(config, 'org-123');

			expect(result.success).toBe(true);
			consoleSpy.mockRestore();
		});
	});

	describe('getRateLimiter — caching', () => {
		beforeEach(() => {
			vi.resetModules();
			process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
			process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
		});

		it('returns a limiter instance when Redis is configured', async () => {
			const { getRateLimiter } = await import('@/server/lib/rate-limit');
			const limiter = getRateLimiter(config);
			expect(limiter).not.toBeNull();
		});

		it('returns the same instance for the same config (cache hit)', async () => {
			const { getRateLimiter } = await import('@/server/lib/rate-limit');
			const first = getRateLimiter(config);
			const second = getRateLimiter(config);
			expect(first).toBe(second);
		});

		it('returns different instances for different prefixes', async () => {
			const { getRateLimiter } = await import('@/server/lib/rate-limit');
			const a = getRateLimiter(config);
			const b = getRateLimiter({ ...config, prefix: 'other:endpoint' });
			expect(a).not.toBe(b);
		});

		it('returns null when Redis is not configured', async () => {
			delete process.env.UPSTASH_REDIS_REST_URL;
			delete process.env.UPSTASH_REDIS_REST_TOKEN;
			const { getRateLimiter } = await import('@/server/lib/rate-limit');
			const result = getRateLimiter(config);
			expect(result).toBeNull();
		});
	});
});
