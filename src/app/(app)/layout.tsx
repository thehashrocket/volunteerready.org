import { AppProviders } from '@/app/(app)/providers';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppProviders>
			<main className="container mx-auto px-4 py-10">{children}</main>
		</AppProviders>
	);
}
