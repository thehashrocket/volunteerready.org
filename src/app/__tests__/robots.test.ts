import { describe, expect, it } from 'vitest';
import robots from '../robots';

describe('robots()', () => {
	it('allows public paths and disallows app/api paths', () => {
		const result = robots();
		const rule = result.rules;
		expect(Array.isArray(rule)).toBe(true);

		const mainRule = Array.isArray(rule) ? rule[0] : rule;
		expect(mainRule.userAgent).toBe('*');
		expect(mainRule.allow).toContain('/');
		expect(mainRule.disallow).toContain('/app/');
		expect(mainRule.disallow).toContain('/api/');
		expect(mainRule.disallow).toContain('/login');
	});

	it('allows the OG image API', () => {
		const result = robots();
		const mainRule = Array.isArray(result.rules)
			? result.rules[0]
			: result.rules;
		expect(mainRule.allow).toContain('/api/og/');
	});

	it('includes sitemap URL', () => {
		const result = robots();
		expect(result.sitemap).toMatch(/sitemap\.xml$/);
	});
});
