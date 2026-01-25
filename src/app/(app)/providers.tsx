'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<SessionProvider>
			<TRPCProvider>{children}</TRPCProvider>
		</SessionProvider>
	);
}
