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

export function OrgSwitcher() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session } = useSession();

	const sessionExt = session as
		| (typeof session & { currentOrgId?: string })
		| null;

	const orgsQ = trpc.org.listOrgs.useQuery();
	const currentQ = trpc.org.getCurrentOrg.useQuery(undefined, {
		staleTime: 10_000,
		enabled: Boolean(sessionExt?.currentOrgId),
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
	const currentOrgId = sessionExt?.currentOrgId ?? null;
	const current =
		currentQ.data ?? orgs.find((org) => org.id === currentOrgId) ?? null;

	const currentName = useMemo(() => {
		if (current?.name) return current.name;
		if (orgs.length === 1) return orgs[0]?.name;
		return 'Select org';
	}, [current, orgs]);

	if (orgsQ.isLoading) return null;
	if (orgs.length === 0) {
		return (
			<Link
				href="/app/welcome"
				className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
			>
				Get started
			</Link>
		);
	}

	if (orgs.length === 1) {
		return (
			// Narrower at base than the old flat `max-w-[120px]`: the header's left
			// cluster is now allowed to shrink, so this cap is a FLOOR on
			// readability rather than a ceiling on width — at 375px a 120px name
			// beside the toggle, the mark and the company switcher is what pushed
			// the account button off the edge.
			<div className="max-w-24 truncate text-xs text-muted-foreground sm:max-w-40 lg:max-w-[200px]">
				{orgs[0]?.name}
			</div>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 max-w-[120px] shrink justify-between text-xs sm:max-w-[180px] lg:max-w-[220px]"
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
							onClick={() => {
								// Dirty forms (e.g. /app/settings org profile) set this flag
								// so switching orgs can't silently discard unsaved edits.
								if (
									document.body.dataset.dirtyForm === 'true' &&
									!window.confirm('Discard unsaved changes?')
								) {
									return;
								}
								switchMutation.mutate({ orgId: org.id });
							}}
							className="flex items-center justify-between"
						>
							<span className="truncate">{org.name}</span>
							{isCurrent ? <Check className="h-4 w-4 opacity-70" /> : null}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/app/onboarding" className="flex items-center gap-2">
						<Plus className="h-4 w-4" />
						Create organization
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
