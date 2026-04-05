import { AppProviders } from '@/app/(app)/providers';

const operationalStyles = {
	'--page-bg': '#FFFFFF',
	'--surface-bg': '#FAFAF8',
	'--section-spacing': '32px',
	'--heading-font': 'var(--font-geist-sans)',
	'--content-max-width': '100%',
} as React.CSSProperties;

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div style={operationalStyles}>
			<AppProviders>
				<main className="container mx-auto px-4 py-10">{children}</main>
			</AppProviders>
		</div>
	);
}
