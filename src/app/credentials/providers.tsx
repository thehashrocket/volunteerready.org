'use client';

import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function CredentialProviders({ children }: { children: ReactNode }) {
	return <TRPCProvider>{children}</TRPCProvider>;
}
