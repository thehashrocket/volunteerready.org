import { AppShell } from '@/components/app/app-shell';
import { AuthFeedback } from '@/components/auth-feedback';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppShell>
			<AuthFeedback />
			{children}
		</AppShell>
	);
}
