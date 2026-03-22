import { PublicHeader } from '@/components/public-header';
import { OpportunitiesProviders } from './providers';

export default function OpportunitiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<OpportunitiesProviders>
			<PublicHeader />
			{children}
		</OpportunitiesProviders>
	);
}
