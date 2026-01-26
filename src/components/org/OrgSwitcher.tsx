'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function OrgSwitcher() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session } = useSession();

	const orgsQ = trpc.org.listOrgs.useQuery();
	const currentQ = trpc.org.getCurrentOrg.useQuery(undefined, {
		staleTime: 10_000,
		enabled: Boolean((session as any)?.currentOrgId),
	});

	const switchMutation = trpc.org.switchOrg.useMutation({
		onSuccess: async (res) => {
			const next = orgsQ.data?.find((o) => o.id === res.orgId);
			toast.success(`Switched to ${next?.name ?? 'organization'}`);
			router.refresh();
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to switch organization');
		},
	});

	const orgs = orgsQ.data ?? [];
	const currentOrgId = (session as any)?.currentOrgId ?? null;
	const current =
		currentQ.data ?? orgs.find((org) => org.id === currentOrgId) ?? null;

	const currentName = useMemo(() => {
		if (current?.name) return current.name;
		if (orgs.length === 1) return orgs[0]!.name;
		return 'Select org';
	}, [current, orgs]);

	if (orgsQ.isLoading) return null;
	if (orgs.length === 0) return null;

	if (orgs.length === 1) {
		return <div className="text-xs text-muted-foreground">{orgs[0]!.name}</div>;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 min-w-[220px] justify-between text-xs"
					disabled={switchMutation.isPending}
				>
					<span className="truncate">{currentName}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" className="w-[220px]">
				{orgs.map((org) => {
					const isCurrent = current?.id === org.id;
					return (
						<DropdownMenuItem
							key={org.id}
							onClick={() => switchMutation.mutate({ orgId: org.id })}
							className="flex items-center justify-between"
						>
							<span className="truncate">{org.name}</span>
							{isCurrent ? <Check className="h-4 w-4 opacity-70" /> : null}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
