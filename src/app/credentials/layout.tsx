import { PublicHeader } from '@/components/public-header';
import { CredentialProviders } from './providers';

const editorialStyles = {
	'--page-bg': '#FAFAF8',
	'--surface-bg': '#F5F4F0',
	'--section-spacing': '64px',
	'--heading-font': 'var(--font-fraunces)',
	'--content-max-width': '1120px',
} as React.CSSProperties;

export default function CredentialsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div style={editorialStyles}>
			<CredentialProviders>
				<PublicHeader />
				<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
			</CredentialProviders>
		</div>
	);
}
