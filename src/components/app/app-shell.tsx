'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface AppShellProps {
	children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	const { data: session } = useSession();
	const orgsQuery = trpc.org.listOrgs.useQuery();
	const switchOrg = trpc.org.switchOrg.useMutation();
	const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

	const orgs = orgsQuery.data ?? [];
	const selectedOrg = useMemo(() => {
		return orgs.find((org) => org.id === selectedOrgId) ?? orgs[0] ?? null;
	}, [orgs, selectedOrgId]);

	useEffect(() => {
		if (!selectedOrgId && orgs.length > 0) {
			setSelectedOrgId(orgs[0].id);
		}
	}, [orgs, selectedOrgId]);

	const handleOrgChange = async (orgId: string) => {
		setSelectedOrgId(orgId);
		await switchOrg.mutateAsync({ orgId });
	};

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b">
				<div className="container mx-auto flex h-14 items-center justify-between px-4">
					<div className="flex items-center gap-4">
						<Link className="text-sm font-semibold" href="/app">
							VolunteerMatch
						</Link>
						{orgs.length > 1 ? (
							<Select
								value={selectedOrg?.id ?? undefined}
								onValueChange={handleOrgChange}
							>
								<SelectTrigger className="h-8 w-[200px] text-xs">
									<SelectValue placeholder="Select org" />
								</SelectTrigger>
								<SelectContent>
									{orgs.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : selectedOrg ? (
							<span className="text-xs text-muted-foreground">
								{selectedOrg.name}
							</span>
						) : null}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 gap-2 text-xs">
								<User className="h-4 w-4" />
								<span>{session?.user?.email ?? 'Account'}</span>
								<ChevronDown className="h-4 w-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuLabel>Signed in</DropdownMenuLabel>
							<DropdownMenuItem disabled>
								{session?.user?.email ?? 'No email'}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => signOut()}>
								<LogOut className="mr-2 h-4 w-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}
