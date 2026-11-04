export type PublicPage = {
	slug: string;
	href: string;
	label: string;
	nav?: boolean;
	/** Position in the header nav (ascending). Pages without one sort last. */
	navOrder?: number;
	footerSection?: string;
	sitemap?: {
		changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
		priority: number;
	};
	og?: {
		heading: string;
		subheading: string;
	};
};

export const PUBLIC_PAGES: PublicPage[] = [
	{
		slug: 'home',
		href: '/',
		label: 'Home',
		sitemap: { changeFrequency: 'daily', priority: 1.0 },
		og: {
			heading: 'Volunteer Hours, Screening & Funder Reports',
			subheading: 'VolunteerReady',
		},
	},
	{
		slug: 'about',
		href: '/about',
		label: 'About',
		nav: true,
		navOrder: 4,
		footerSection: 'Platform',
		sitemap: { changeFrequency: 'monthly', priority: 0.7 },
		og: {
			heading: 'The Story Behind VolunteerReady',
			subheading: 'About Us',
		},
	},
	{
		slug: 'how-it-works',
		href: '/how-it-works',
		label: 'How It Works',
		nav: true,
		navOrder: 1,
		footerSection: 'Platform',
		sitemap: { changeFrequency: 'monthly', priority: 0.8 },
		og: {
			heading: 'From First Shift to Funder Report',
			subheading: 'How It Works',
		},
	},
	{
		slug: 'for',
		href: '/for',
		label: 'For',
		sitemap: { changeFrequency: 'monthly', priority: 0.6 },
		og: {
			heading: 'Who VolunteerReady Is For',
			subheading: 'Audiences',
		},
	},
	{
		slug: 'for-volunteers',
		href: '/for/volunteers',
		label: 'For Volunteers',
		sitemap: { changeFrequency: 'monthly', priority: 0.8 },
		og: {
			heading: 'Find Opportunities. Earn Portable Credentials.',
			subheading: 'For Volunteers',
		},
	},
	{
		slug: 'for-nonprofits',
		href: '/for/nonprofits',
		label: 'For Nonprofits',
		nav: true,
		navOrder: 2,
		sitemap: { changeFrequency: 'monthly', priority: 0.8 },
		og: {
			heading: 'Hours, Screening & Funder Reports for Nonprofits',
			subheading: 'For Nonprofits',
		},
	},
	{
		slug: 'for-employers',
		href: '/for/employers',
		label: 'For Employers',
		sitemap: { changeFrequency: 'monthly', priority: 0.7 },
		og: {
			heading: 'Track Employee Volunteering & ESG Impact',
			subheading: 'For Employers',
		},
	},
	{
		slug: 'for-animal-shelters',
		href: '/for/animal-shelters',
		label: 'For Animal Shelters',
		sitemap: { changeFrequency: 'monthly', priority: 0.8 },
		og: {
			heading: 'Volunteer Screening for Animal Shelters',
			subheading: 'Animal Shelters',
		},
	},
	{
		slug: 'stories',
		href: '/stories',
		label: 'Stories',
		sitemap: { changeFrequency: 'weekly', priority: 0.6 },
		og: {
			heading: 'Real Impact from Real Nonprofits',
			subheading: 'Customer Stories',
		},
	},
	{
		slug: 'pricing',
		href: '/pricing',
		label: 'Pricing',
		nav: true,
		navOrder: 3,
		footerSection: 'Platform',
		sitemap: { changeFrequency: 'monthly', priority: 0.7 },
		og: {
			heading: 'Simple, Transparent Pricing. No Surprises.',
			subheading: 'Pricing',
		},
	},
	{
		slug: 'screening',
		href: '/screening',
		label: 'Screening',
		sitemap: { changeFrequency: 'monthly', priority: 0.7 },
		og: {
			heading: 'Background Checks for Nonprofits — $29/mo',
			subheading: 'Volunteer Screening',
		},
	},
	{
		slug: 'opportunities',
		href: '/opportunities',
		label: 'Opportunities',
		footerSection: 'Volunteers',
		sitemap: { changeFrequency: 'daily', priority: 0.9 },
		og: {
			heading: 'Find Volunteer Opportunities Near You',
			subheading: 'Volunteer Opportunities',
		},
	},
	{
		slug: 'organizations',
		href: '/organizations',
		label: 'Organizations',
		footerSection: 'Volunteers',
		sitemap: { changeFrequency: 'weekly', priority: 0.7 },
		og: {
			heading: 'Discover Nonprofits Looking for Volunteers',
			subheading: 'Nonprofit Organizations',
		},
	},
	{
		slug: 'map',
		href: '/map',
		label: 'Map',
		footerSection: 'Volunteers',
		sitemap: { changeFrequency: 'daily', priority: 0.8 },
		og: {
			heading: 'Find Volunteer Opportunities Near You',
			subheading: 'Volunteer Map',
		},
	},
	{
		slug: 'search',
		href: '/search',
		label: 'Search',
		footerSection: 'Volunteers',
		sitemap: { changeFrequency: 'monthly', priority: 0.5 },
		og: {
			heading: 'Search Volunteer Opportunities & Resources',
			subheading: 'Search',
		},
	},
	{
		slug: 'security',
		href: '/security',
		label: 'Security',
		footerSection: 'Platform',
		sitemap: { changeFrequency: 'yearly', priority: 0.4 },
		og: {
			heading: 'Data Protection & FCRA Compliance',
			subheading: 'Security & Compliance',
		},
	},
	{
		slug: 'privacy',
		href: '/privacy',
		label: 'Privacy Policy',
		footerSection: 'Legal',
		sitemap: { changeFrequency: 'yearly', priority: 0.3 },
		og: {
			heading: 'How We Collect, Use & Protect Your Data',
			subheading: 'Privacy Policy',
		},
	},
	{
		slug: 'terms',
		href: '/terms',
		label: 'Terms of Service',
		footerSection: 'Legal',
		sitemap: { changeFrequency: 'yearly', priority: 0.3 },
		og: {
			heading: 'Terms & Conditions for the Platform',
			subheading: 'Terms of Service',
		},
	},
];

export function getNavPages(): { label: string; href: string }[] {
	return PUBLIC_PAGES.filter((p) => p.nav)
		.sort(
			(a, b) =>
				(a.navOrder ?? Number.POSITIVE_INFINITY) -
				(b.navOrder ?? Number.POSITIVE_INFINITY),
		)
		.map(({ label, href }) => ({ label, href }));
}

export function getFooterPages(
	section: string,
): { label: string; href: string }[] {
	return PUBLIC_PAGES.filter((p) => p.footerSection === section).map(
		({ label, href }) => ({ label, href }),
	);
}

export function getSitemapPages(): {
	href: string;
	changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
	priority: number;
}[] {
	return PUBLIC_PAGES.filter((p) => p.sitemap).map((p) => ({
		href: p.href,
		// biome-ignore lint/style/noNonNullAssertion: filtered above
		changeFrequency: p.sitemap!.changeFrequency,
		// biome-ignore lint/style/noNonNullAssertion: filtered above
		priority: p.sitemap!.priority,
	}));
}

export function getOgPageMeta(): Record<
	string,
	{ heading: string; subheading: string }
> {
	const meta: Record<string, { heading: string; subheading: string }> = {};
	for (const page of PUBLIC_PAGES) {
		if (page.og) {
			meta[page.slug] = page.og;
		}
	}
	return meta;
}
