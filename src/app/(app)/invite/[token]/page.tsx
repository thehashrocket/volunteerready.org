'use client';

import { useParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	STAFF: 'Staff',
	READONLY: 'Read-only',
};

function CenteredPage({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<div className="w-full max-w-md">{children}</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvitePage() {
	const { token } = useParams<{ token: string }>();
	const { data: session, status } = useSession();
	const router = useRouter();

	const query = trpc.members.getInvitation.useQuery({ token });

	const accept = trpc.members.accept.useMutation({
		onSuccess: (data) => {
			if (data.alreadyMember) {
				toast.info('You are already a member of this organization.');
			} else {
				toast.success('You have joined the organization!');
			}
			router.push('/app');
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to accept invitation.');
		},
	});

	// Loading
	if (query.isLoading || status === 'loading') {
		return (
			<CenteredPage>
				<Card>
					<CardContent className="pt-6 text-sm text-muted-foreground">
						Loading invitation…
					</CardContent>
				</Card>
			</CenteredPage>
		);
	}

	// Invalid or expired
	if (!query.data || query.data.isExpired) {
		return (
			<CenteredPage>
				<Card>
					<CardHeader>
						<CardTitle>Invitation not valid</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>This invitation is invalid or has already expired.</p>
						<p>Please ask your organization admin to send a new invitation.</p>
					</CardContent>
				</Card>
			</CenteredPage>
		);
	}

	const inv = query.data;
	const roleLabel = ROLE_LABELS[inv.role] ?? inv.role;

	// Not signed in
	if (!session) {
		return (
			<CenteredPage>
				<Card>
					<CardHeader>
						<CardTitle>Join {inv.orgName}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm">
							You've been invited to join <strong>{inv.orgName}</strong> as{' '}
							<strong>{roleLabel}</strong>.
						</p>
						<p className="text-sm text-muted-foreground">
							This invite was sent to <strong>{inv.maskedEmail}</strong>. Sign
							in with that email to accept.
						</p>
						<Button onClick={() => signIn()} className="w-full">
							Sign in to accept
						</Button>
					</CardContent>
				</Card>
			</CenteredPage>
		);
	}

	// Signed in — let user accept (server validates email match)
	return (
		<CenteredPage>
			<Card>
				<CardHeader>
					<CardTitle>Join {inv.orgName}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm">
						Accept your invitation to join <strong>{inv.orgName}</strong> as{' '}
						<strong>{roleLabel}</strong>.
					</p>
					<p className="text-sm text-muted-foreground">
						Invite sent to <strong>{inv.maskedEmail}</strong>.
					</p>
					{accept.isError && (
						<p role="alert" className="text-sm text-destructive">
							{safeErrorMessage(accept.error) ??
								'Could not accept that invitation.'}
						</p>
					)}
					<Button
						onClick={() => accept.mutate({ token })}
						disabled={accept.isPending}
						className="w-full"
					>
						{accept.isPending ? 'Accepting…' : 'Accept invitation'}
					</Button>
				</CardContent>
			</Card>
		</CenteredPage>
	);
}
