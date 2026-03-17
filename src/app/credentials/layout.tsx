import { PublicHeader } from '@/components/public-header';
import { CredentialProviders } from './providers';

export default function CredentialsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<CredentialProviders>
			<PublicHeader />
			<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
		</CredentialProviders>
	);
}
