import { describe, expect, it } from 'vitest';
import { sentryBeforeSend } from './sentry-before-send';

describe('sentryBeforeSend', () => {
	it('strips sensitive headers', () => {
		const event = {
			request: {
				headers: {
					authorization: 'Bearer token123',
					cookie: 'session=abc',
					'stripe-signature': 't=123,v1=abc',
					'x-checkr-signature': 'sha256=abc',
					'content-type': 'application/json',
				},
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny: test fixture — partial event object
		const result = sentryBeforeSend(event as any);
		expect(result.request?.headers?.authorization).toBeUndefined();
		expect(result.request?.headers?.cookie).toBeUndefined();
		expect(result.request?.headers?.['stripe-signature']).toBeUndefined();
		expect(result.request?.headers?.['x-checkr-signature']).toBeUndefined();
		// Non-sensitive headers preserved
		expect(result.request?.headers?.['content-type']).toBe('application/json');
	});

	it('handles event with no request headers gracefully', () => {
		// biome-ignore lint/suspicious/noExplicitAny: test fixture — partial event object
		expect(() => sentryBeforeSend({} as any)).not.toThrow();
	});
});
