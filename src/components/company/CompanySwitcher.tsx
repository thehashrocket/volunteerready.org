'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc/client';

export function CompanySwitcher() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session } = useSession();

	const sessionExt = session as
		| (typeof session & { currentCompanyId?: string })
		| null;

	const companiesQ = trpc.company.listMyCompanies.useQuery();

	const switchMutation = trpc.company.switchCompany.useMutation({
		onSuccess: async (res) => {
			const companies = companiesQ.data ?? [];
			const next = companies.find((c) => c.company.id === res.companyId);
			toast.success(`Switched to ${next?.company.name ?? 'company'}`);
			router.refresh();
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to switch company');
		},
	});

	const memberships = companiesQ.data ?? [];
	const currentCompanyId = sessionExt?.currentCompanyId ?? null;

	const currentName = useMemo(() => {
		if (memberships.length === 0) return null;
		const match = memberships.find((m) => m.company.id === currentCompanyId);
		if (match?.company.name) return match.company.name;
		if (memberships.length === 1) return memberships[0]?.company.name;
		return 'Select company';
	}, [memberships, currentCompanyId]);

	if (companiesQ.isLoading) return null;
	if (memberships.length === 0) {
		return (
			<Link
				href="/app/company/new"
				className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
			>
				Add company
			</Link>
		);
	}

	if (memberships.length === 1) {
		return (
			<div className="text-xs text-muted-foreground">
				{memberships[0]?.company.name}
			</div>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 min-w-[180px] justify-between text-xs"
					disabled={switchMutation.isPending}
				>
					<span className="truncate">{currentName}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" className="w-[180px]">
				{memberships.map(({ company }) => {
					const isCurrent = company.id === currentCompanyId;
					return (
						<DropdownMenuItem
							key={company.id}
							onClick={() => switchMutation.mutate({ companyId: company.id })}
							className="flex items-center justify-between"
						>
							<span className="truncate">{company.name}</span>
							{isCurrent ? <Check className="h-4 w-4 opacity-70" /> : null}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/app/company/new" className="flex items-center gap-2">
						<Plus className="h-4 w-4" />
						Create company
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
