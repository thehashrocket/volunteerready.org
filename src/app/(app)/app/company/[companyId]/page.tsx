'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

export default function CompanyDashboardPage() {
	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteOpen, setInviteOpen] = useState(false);
	const [linkOrgId, setLinkOrgId] = useState('');
	const [linkOpen, setLinkOpen] = useState(false);

	const currentQ = trpc.company.getCurrent.useQuery();
	const linkedQ = trpc.company.listLinkedNonprofits.useQuery();

	const inviteMutation = trpc.company.invite.useMutation({
		onSuccess: () => {
			toast.success('Invitation sent!');
			setInviteEmail('');
			setInviteOpen(false);
		},
		onError: (err) => toast.error(err.message ?? 'Failed to send invite'),
	});

	const linkMutation = trpc.company.linkNonprofit.useMutation({
		onSuccess: () => {
			toast.success('Nonprofit linked!');
			setLinkOrgId('');
			setLinkOpen(false);
			linkedQ.refetch();
		},
		onError: (err) => toast.error(err.message ?? 'Failed to link nonprofit'),
	});

	const unlinkMutation = trpc.company.unlinkNonprofit.useMutation({
		onSuccess: () => {
			toast.success('Nonprofit unlinked.');
			linkedQ.refetch();
		},
		onError: (err) => toast.error(err.message ?? 'Failed to unlink'),
	});

	const company = currentQ.data;
	const linkedNonprofits = linkedQ.data ?? [];

	return (
		<div className="max-w-2xl space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-display text-2xl font-bold">{company?.name ?? 'Company'}</h1>
					<p className="text-muted-foreground">Company dashboard</p>
				</div>
				{company?.planTier && (
					<Badge
						variant={company.planTier === 'FREE' ? 'secondary' : 'default'}
					>
						{company.planTier}
					</Badge>
				)}
			</div>

			{/* Linked nonprofits */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Linked nonprofits</h2>
					<Dialog open={linkOpen} onOpenChange={setLinkOpen}>
						<DialogTrigger asChild>
							<Button size="sm" variant="outline">
								Link nonprofit
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Link a nonprofit</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="orgId">Organization ID</Label>
									<Input
										id="orgId"
										value={linkOrgId}
										onChange={(e) => setLinkOrgId(e.target.value)}
										placeholder="cuid..."
									/>
								</div>
								<Button
									onClick={() => linkMutation.mutate({ orgId: linkOrgId })}
									disabled={linkMutation.isPending || !linkOrgId.trim()}
									className="w-full"
								>
									{linkMutation.isPending ? 'Linking…' : 'Link'}
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>

				{linkedNonprofits.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No nonprofits linked yet.
					</p>
				) : (
					<ul className="space-y-2">
						{linkedNonprofits.map((link) => (
							<li
								key={link.id}
								className="flex items-center justify-between rounded-md border px-4 py-3"
							>
								<div>
									<div className="font-medium">{link.org.name}</div>
									<div className="text-xs text-muted-foreground">
										{link.org.slug}
									</div>
								</div>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => unlinkMutation.mutate({ orgId: link.org.id })}
									disabled={unlinkMutation.isPending}
								>
									Unlink
								</Button>
							</li>
						))}
					</ul>
				)}
			</section>

			{/* Invite member */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Team members</h2>
					<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
						<DialogTrigger asChild>
							<Button size="sm" variant="outline">
								Invite member
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Invite a team member</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email address</Label>
									<Input
										id="email"
										type="email"
										value={inviteEmail}
										onChange={(e) => setInviteEmail(e.target.value)}
										placeholder="colleague@company.com"
									/>
								</div>
								<Button
									onClick={() =>
										inviteMutation.mutate({
											email: inviteEmail,
											role: 'MEMBER',
										})
									}
									disabled={inviteMutation.isPending || !inviteEmail.trim()}
									className="w-full"
								>
									{inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</section>
		</div>
	);
}
