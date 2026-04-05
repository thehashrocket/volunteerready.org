import { PublicFooter } from '@/components/public-footer';
import { PublicHeader } from '@/components/public-header';

const editorialStyles = {
	'--page-bg': '#FAFAF8',
	'--surface-bg': '#F5F4F0',
	'--section-spacing': '64px',
	'--heading-font': 'var(--font-fraunces)',
	'--content-max-width': '1120px',
} as React.CSSProperties;

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div style={editorialStyles}>
			<PublicHeader />
			{children}
			<PublicFooter />
		</div>
	);
}
