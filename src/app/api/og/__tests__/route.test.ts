import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: vi.fn(async () => null) },
	},
}));

// Mock next/og ImageResponse to avoid needing canvas/sharp
vi.mock('next/og', () => ({
	ImageResponse: class {
		constructor(
			public element: unknown,
			public options: unknown,
		) {}
	},
}));

// Mock font loading — no real font files in test
vi.mock('node:fs', () => ({
	readFileSync: vi.fn(() => Buffer.from('fake-font')),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/server/repositories/prisma';
import { GET } from '../[type]/[slug]/route';

const BASE_URL = 'http://localhost:3005';

function makeRequest(
	type: string,
	slug: string,
): [NextRequest, { params: Promise<{ type: string; slug: string }> }] {
	const url = `${BASE_URL}/api/og/${type}/${slug}`;
	return [
		new NextRequest(new URL(url)),
		{ params: Promise.resolve({ type, slug }) },
	];
}

describe('OG Image Route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 400 for invalid type', async () => {
		const res = await GET(...makeRequest('invalid', 'test'));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(400);
	});

	it('returns 404 for unknown page slug', async () => {
		const res = await GET(...makeRequest('page', 'nonexistent'));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(404);
	});

	it('returns 404 when org not found for apply type', async () => {
		vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);
		const res = await GET(...makeRequest('apply', 'missing-org'));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(404);
	});

	it('returns ImageResponse for valid page type', async () => {
		const res = await GET(...makeRequest('page', 'pricing'));
		// ImageResponse is mocked, so we get the mock class instance
		expect(res).not.toBeInstanceOf(Response);
		expect(res).toHaveProperty('element');
	});

	it('returns ImageResponse for valid org type', async () => {
		vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
			name: 'Test Org',
		} as never);
		const res = await GET(...makeRequest('apply', 'test-org'));
		expect(res).not.toBeInstanceOf(Response);
		expect(res).toHaveProperty('element');
	});

	it('validates all expected page slugs', async () => {
		const validSlugs = [
			'home',
			'pricing',
			'screening',
			'for-nonprofits',
			'for-volunteers',
			'for-employers',
		];
		for (const slug of validSlugs) {
			const res = await GET(...makeRequest('page', slug));
			expect(res).not.toBeInstanceOf(Response);
		}
	});
});
