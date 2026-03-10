import { PublicHeader } from '@/components/public-header';

export default function OpportunitiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<PublicHeader />
			{children}
		</>
	);
}
