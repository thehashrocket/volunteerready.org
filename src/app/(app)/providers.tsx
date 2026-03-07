'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<SessionProvider>
			<TRPCProvider>{children}</TRPCProvider>
		</SessionProvider>
	);
}
