import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: vi.fn(async () => null) },
	},
}));

// Mock next/og ImageResponse to avoid needing canvas/sharp
vi.mock('@/server/repositories/orgRepo', () => ({
	findCurrentSlugByHistory: vi.fn(async () => null),
}));

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
import { getOgPageMeta } from '@/lib/public-pages';
import { PLATFORM_ORG_SLUG } from '@/server/domain/reference-data';
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

	it('validates all page slugs from registry', async () => {
		const validSlugs = Object.keys(getOgPageMeta());
		for (const slug of validSlugs) {
			const res = await GET(...makeRequest('page', slug));
			expect(res).not.toBeInstanceOf(Response);
		}
	});

	// Value: protects=the internal platform org gets no public OG image;
	// fails_when=the platform slug guard is removed; why_new=no test covered
	// the platform slug; seam=none
	it('returns 404 for the platform org without looking it up', async () => {
		for (const type of ['apply', 'opportunities', 'stories']) {
			const res = await GET(...makeRequest(type, PLATFORM_ORG_SLUG));
			expect((res as Response).status).toBe(404);
		}
		// Refused before any lookup, so the org's name is never read.
		expect(prisma.organization.findUnique).not.toHaveBeenCalled();
	});

	it('returns 404 when an old slug now belongs to the platform org', async () => {
		const { findCurrentSlugByHistory } = await import(
			'@/server/repositories/orgRepo'
		);
		vi.mocked(findCurrentSlugByHistory).mockResolvedValueOnce(
			PLATFORM_ORG_SLUG,
		);

		const res = await GET(...makeRequest('apply', 'old-slug'));

		expect((res as Response).status).toBe(404);
		expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
	});
});
