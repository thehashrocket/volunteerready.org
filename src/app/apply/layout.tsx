import { PublicHeader } from '@/components/public-header';

export default function ApplyLayout({
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
