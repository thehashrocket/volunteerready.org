import { BASE_URL } from '@/lib/constants';

interface BreadcrumbItem {
	label: string;
	href: string;
}

export function JsonLdBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: item.label,
			item: `${BASE_URL}${item.href}`,
		})),
	};

	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, '\\u003c'),
			}}
		/>
	);
}
