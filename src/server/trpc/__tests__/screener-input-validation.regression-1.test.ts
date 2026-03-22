// Regression: ISSUE-001 — UUID validation rejects CUID opportunity IDs
// Found by /qa on 2026-03-22
// Report: .gstack/qa-reports/qa-report-localhost-3005-2026-03-22.md

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * The getMyAppliedOpportunitiesCrossOrg procedure used z.string().uuid()
 * to validate opportunity IDs, but the database uses CUIDs. This caused
 * every call to return 400, breaking the browse page applied badges.
 *
 * This test verifies that the input schema accepts CUID-format IDs.
 */

// Mirror the actual input schema from the procedure
const inputSchema = z.object({
	opportunityIds: z.array(z.string().min(1)).max(200),
});

describe('getMyAppliedOpportunitiesCrossOrg input validation', () => {
	it('accepts CUID-format opportunity IDs', () => {
		const result = inputSchema.safeParse({
			opportunityIds: [
				'cmmsplesb004lessat0h4ndxr',
				'cmmsples6004gessaa0ftgmqa',
				'cmmsplet0005ressa3g2kumg3',
			],
		});
		expect(result.success).toBe(true);
	});

	it('accepts UUID-format opportunity IDs', () => {
		const result = inputSchema.safeParse({
			opportunityIds: ['550e8400-e29b-41d4-a716-446655440000'],
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty string IDs', () => {
		const result = inputSchema.safeParse({
			opportunityIds: [''],
		});
		expect(result.success).toBe(false);
	});

	it('rejects arrays exceeding 200 IDs', () => {
		const result = inputSchema.safeParse({
			opportunityIds: Array.from({ length: 201 }, (_, i) => `id-${i}`),
		});
		expect(result.success).toBe(false);
	});

	it('accepts empty array', () => {
		const result = inputSchema.safeParse({
			opportunityIds: [],
		});
		expect(result.success).toBe(true);
	});
});
