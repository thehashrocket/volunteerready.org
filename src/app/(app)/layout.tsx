import { AppProviders } from '@/app/(app)/providers';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return <AppProviders>{children}</AppProviders>;
}
