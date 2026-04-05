import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public-header';

export const metadata: Metadata = {
	title: 'Sign in',
};

const editorialStyles = {
	'--page-bg': '#FAFAF8',
	'--surface-bg': '#F5F4F0',
	'--section-spacing': '64px',
	'--heading-font': 'var(--font-fraunces)',
	'--content-max-width': '1120px',
} as React.CSSProperties;

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div style={editorialStyles}>
			<PublicHeader />
			{children}
		</div>
	);
}
