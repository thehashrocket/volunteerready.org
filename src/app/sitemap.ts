import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';
import { LOCATIONS } from '@/lib/locations';
import { getSitemapPages } from '@/lib/public-pages';
import { prisma } from '@/server/repositories/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Static public pages (from centralized registry)
	const staticRoutes: MetadataRoute.Sitemap = getSitemapPages().map((page) => ({
		url: page.href === '/' ? BASE_URL : `${BASE_URL}${page.href}`,
		changeFrequency: page.changeFrequency,
		priority: page.priority,
	}));

	// Dynamic routes: org-specific public pages
	const orgs = await prisma.organization.findMany({
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

	const locationIndexRoute: MetadataRoute.Sitemap = [
		{
			url: `${BASE_URL}/locations`,
			changeFrequency: 'monthly',
			priority: 0.6,
		},
	];

	const locationRoutes: MetadataRoute.Sitemap = LOCATIONS.map((loc) => ({
		url: `${BASE_URL}/locations/${loc.slug}`,
		changeFrequency: 'monthly' as const,
		priority: 0.7,
	}));

	return [
		...staticRoutes,
		...locationIndexRoute,
		...locationRoutes,
		...applyRoutes,
		...opportunityRoutes,
		...storyRoutes,
	];
}
