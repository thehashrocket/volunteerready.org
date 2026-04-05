import { PublicHeader } from '@/components/public-header';
import { OpportunitiesProviders } from './providers';

const editorialStyles = {
	'--page-bg': '#FAFAF8',
	'--surface-bg': '#F5F4F0',
	'--section-spacing': '64px',
	'--heading-font': 'var(--font-fraunces)',
	'--content-max-width': '1120px',
} as React.CSSProperties;

export default function OpportunitiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div style={editorialStyles}>
			<OpportunitiesProviders>
				<PublicHeader />
				{children}
			</OpportunitiesProviders>
		</div>
	);
}
