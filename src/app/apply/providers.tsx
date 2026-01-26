'use client';

import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function ApplyProviders({ children }: { children: ReactNode }) {
	return <TRPCProvider>{children}</TRPCProvider>;
}
