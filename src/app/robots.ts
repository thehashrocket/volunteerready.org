import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: ['/', '/api/og/'],
				disallow: ['/app/', '/api/', '/login', '/credentials/', '/invite/'],
			},
		],
		sitemap: `${BASE_URL}/sitemap.xml`,
	};
}
