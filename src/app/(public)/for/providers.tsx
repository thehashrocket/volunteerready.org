'use client';

import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function ForProviders({ children }: { children: ReactNode }) {
	return <TRPCProvider>{children}</TRPCProvider>;
}
