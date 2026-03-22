import type { MetadataRoute } from 'next';
import { prisma } from '@/server/repositories/prisma';

const BASE_URL = 'https://www.volunteerready.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const now = new Date();

	// Static public pages
	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: BASE_URL,
			lastModified: now,
			changeFrequency: 'daily',
			priority: 1.0,
		},
		{
			url: `${BASE_URL}/about`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.7,
		},
		{
			url: `${BASE_URL}/how-it-works`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.8,
		},
		{
			url: `${BASE_URL}/for-volunteers`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.8,
		},
		{
			url: `${BASE_URL}/for-nonprofits`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.8,
		},
		{
			url: `${BASE_URL}/for-employers`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.7,
		},
		{
			url: `${BASE_URL}/pricing`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.7,
		},
		{
			url: `${BASE_URL}/screening`,
			lastModified: now,
			changeFrequency: 'monthly',
			priority: 0.7,
		},
		{
			url: `${BASE_URL}/security`,
			lastModified: now,
			changeFrequency: 'yearly',
			priority: 0.4,
		},
		{
			url: `${BASE_URL}/privacy`,
			lastModified: now,
			changeFrequency: 'yearly',
			priority: 0.3,
		},
		{
			url: `${BASE_URL}/terms`,
			lastModified: now,
			changeFrequency: 'yearly',
			priority: 0.3,
		},
	];

	// Dynamic routes: org-specific public pages
	const orgs = await prisma.organization.findMany({
		where: { deletedAt: null },
		select: { slug: true, updatedAt: true, consentToPublicize: true },
	});

	const applyRoutes: MetadataRoute.Sitemap = orgs.map((org) => ({
		url: `${BASE_URL}/apply/${org.slug}`,
		lastModified: org.updatedAt,
		changeFrequency: 'weekly' as const,
		priority: 0.6,
	}));

	const opportunityRoutes: MetadataRoute.Sitemap = orgs.map((org) => ({
		url: `${BASE_URL}/opportunities/${org.slug}`,
		lastModified: org.updatedAt,
		changeFrequency: 'weekly' as const,
		priority: 0.6,
	}));

	const storyRoutes: MetadataRoute.Sitemap = orgs
		.filter((org) => org.consentToPublicize)
		.map((org) => ({
			url: `${BASE_URL}/stories/${org.slug}`,
			lastModified: org.updatedAt,
			changeFrequency: 'monthly' as const,
			priority: 0.5,
		}));

	return [
		...staticRoutes,
		...applyRoutes,
		...opportunityRoutes,
		...storyRoutes,
	];
}
