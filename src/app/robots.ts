import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/app/', '/api/', '/login', '/credentials/', '/invite/'],
			},
		],
		sitemap: 'https://www.volunteerready.org/sitemap.xml',
	};
}
