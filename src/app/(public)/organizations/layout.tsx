import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc/provider';

export default function MarketplaceOrgsLayout({
	children,
}: {
	children: ReactNode;
}) {
	return <TRPCProvider>{children}</TRPCProvider>;
}
