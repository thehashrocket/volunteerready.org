import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/locations', () => ({
	getLocationSlugs: () => [
		'stockton',
		'modesto',
		'san-joaquin-county',
		'stanislaus-county',
		'sacramento',
	],
}));

import { leadCaptureSchema } from '../lead-capture';

describe('leadCaptureSchema', () => {
	const validInput = {
		locationSlug: 'stockton',
		orgName: 'Test Org',
		contactEmail: 'test@example.com',
	};

	it('accepts valid minimal input', () => {
		const result = leadCaptureSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it('accepts valid input with all optional fields', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			volunteerCount: '25',
			currentProcess: 'Spreadsheets',
			painPoints: 'Too many spreadsheets',
			org_phone: '',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty orgName', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			orgName: '',
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid email', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			contactEmail: 'not-an-email',
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty locationSlug', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			locationSlug: '',
		});
		expect(result.success).toBe(false);
	});

	it('rejects unknown locationSlug', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			locationSlug: 'nonexistent-city',
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid currentProcess enum value', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			currentProcess: 'InvalidOption',
		});
		expect(result.success).toBe(false);
	});

	it('accepts all valid currentProcess enum values', () => {
		for (const val of ['Spreadsheets', 'Email', 'No system', 'Other']) {
			const result = leadCaptureSchema.safeParse({
				...validInput,
				currentProcess: val,
			});
			expect(result.success).toBe(true);
		}
	});

	it('accepts honeypot field (org_phone)', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			org_phone: 'bot-value',
		});
		expect(result.success).toBe(true);
	});

	it('rejects painPoints exceeding 2000 characters', () => {
		const result = leadCaptureSchema.safeParse({
			...validInput,
			painPoints: 'x'.repeat(2001),
		});
		expect(result.success).toBe(false);
	});
});
