'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

// Matches /app/company/{id} and /app/company/{id}/anything — captures the id
// segment and the trailing subpath (if any).
const COMPANY_ROUTE = /^\/app\/company\/([^/]+)(\/.*)?$/;

// /app/company/new is a static sibling route (the create-company form), not
// a companyId — exclude it so the switcher doesn't mistake "new" for a real
// company and navigate away from (or claim to represent) that page.
function matchCompanyRoute(pathname: string) {
	const match = pathname.match(COMPANY_ROUTE);
	if (!match || match[1] === 'new') return null;
	return { companyId: match[1], subpath: match[2] ?? '' };
}

export function CompanySwitcher() {
	const router = useRouter();
	const pathname = usePathname();
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

			// Company pages are authorized by the URL's companyId, not the
			// session's active company (see company/[companyId]/layout.tsx). If
			// we're on one now, follow the switch to the new company's URL —
			// otherwise the page would keep the old company's id in the URL
			// while its data flips to the new company underneath it.
			const route = matchCompanyRoute(pathname);
			if (route) {
				router.push(`/app/company/${res.companyId}${route.subpath}`);
			} else {
				router.refresh();
			}
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to switch company');
		},
	});

	const memberships = companiesQ.data ?? [];
	// Company pages are authorized by the URL's companyId, not the session's
	// active company — so the switcher's displayed selection follows suit
	// whenever we're on one (mirrors app-sidebar.tsx's urlCompanyId
	// precedence). Otherwise a multi-company user viewing a non-active
	// company would see the switcher itself claim they're on the wrong one.
	const currentCompanyId =
		matchCompanyRoute(pathname)?.companyId ??
		sessionExt?.currentCompanyId ??
		null;

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
				Add company sponsor
			</Link>
		);
	}

	if (memberships.length === 1) {
		return (
			<div className="max-w-[120px] truncate text-xs text-muted-foreground sm:max-w-[180px]">
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
					className="h-8 max-w-[140px] justify-between text-xs sm:max-w-[180px]"
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
