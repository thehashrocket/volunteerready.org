'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { getCredentialMeta } from '@/lib/credential-meta';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClaimClient({ token }: { token: string }) {
	const [claimed, setClaimed] = useState(false);

	const infoQuery = trpc.credentialSharing.getTokenInfo.useQuery({ token });

	const claimMutation = trpc.credentialSharing.claim.useMutation({
		onSuccess: () => {
			setClaimed(true);
			toast.success('Credential claimed successfully.');
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to claim credential.');
		},
	});

	// Loading state
	if (infoQuery.isLoading) {
		return (
			<div className="mx-auto max-w-md py-20">
				<Card>
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						<span className="ml-2 text-muted-foreground">
							Verifying share link...
						</span>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Error state (invalid/expired/already claimed)
	if (infoQuery.isError) {
		return (
			<div className="mx-auto max-w-md py-20">
				<Card>
					<CardContent className="space-y-4 py-12 text-center" role="alert">
						<XCircle className="mx-auto h-10 w-10 text-destructive" />
						{/* Not QueryErrorCard: an expired or already-claimed token is
						    not a retryable failure, and the card leads with a retry
						    button. The named reasons (NOT_FOUND / BAD_REQUEST) are
						    allowlisted and still read verbatim; safeErrorMessage only
						    changes what an unexpected throw shows — on a route a
						    stranger can reach with a guessed token. */}
						{/* The fallback fires ONLY when the message was withheld, i.e. on
						    an internal error — never on the NOT_FOUND/BAD_REQUEST that
						    actually mean "expired", which are allowlisted and read
						    verbatim. So it must NOT claim the link is dead: that is a
						    definite statement about the token, and the request may
						    simply have hit a 500. */}
						<p className="text-sm text-muted-foreground">
							{safeErrorMessage(infoQuery.error) ??
								"We couldn't check that link right now."}
						</p>
						{/* The withheld-message branch is the RETRYABLE one (an internal
						    error, not an expired token), so this surface needs a retry
						    control — the copy above previously told people to try again
						    and offered them only an exit. The allowlisted reasons still
						    read verbatim above and retrying those is harmless. */}
						<div className="flex justify-center gap-3">
							<Button
								variant="outline"
								onClick={() => infoQuery.refetch()}
								disabled={infoQuery.isFetching}
							>
								Try again
							</Button>
							<Button variant="ghost" asChild>
								<Link href="/">Go home</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	const info = infoQuery.data;
	if (!info) return null;

	const meta = getCredentialMeta(info.credentialType);
	const Icon = meta.icon;

	// Post-claim success state
	if (claimed) {
		return (
			<div className="mx-auto max-w-md py-20">
				<Card>
					<CardContent className="space-y-4 py-12 text-center">
						<CheckCircle2 className="mx-auto h-12 w-12 text-success" />
						<h2 className="text-lg font-semibold">Credential claimed</h2>
						<p className="text-sm text-muted-foreground">
							The <span className="font-medium">{meta.label}</span> credential
							from <span className="font-medium">{info.issuingOrgName}</span>{' '}
							has been added to your organization.
						</p>
						<Button asChild>
							<Link href="/app/settings/background-checks">
								View credentials
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Preview + claim action
	return (
		<div className="mx-auto max-w-md py-20">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
						<Icon className="h-7 w-7 text-primary" />
					</div>
					<CardTitle className="mt-4">Shared credential</CardTitle>
					<CardDescription>
						A volunteer has shared a verified credential with your organization.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<dl className="divide-y">
						<div className="flex justify-between py-3 first:pt-0">
							<dt className="text-sm text-muted-foreground">Type</dt>
							<dd className="text-sm font-medium">{meta.label}</dd>
						</div>
						<div className="flex justify-between py-3">
							<dt className="text-sm text-muted-foreground">Issued by</dt>
							<dd className="text-sm font-medium">{info.issuingOrgName}</dd>
						</div>
						<div className="flex justify-between py-3 last:pb-0">
							<dt className="text-sm text-muted-foreground">Link expires</dt>
							<dd className="text-sm font-medium">
								{new Date(info.expiresAt).toLocaleDateString('en-US', {
									month: 'long',
									day: 'numeric',
									year: 'numeric',
								})}
							</dd>
						</div>
					</dl>

					<Button
						className="w-full"
						onClick={() => claimMutation.mutate({ token })}
						disabled={claimMutation.isPending}
					>
						{claimMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Claiming...
							</>
						) : (
							'Claim credential'
						)}
					</Button>

					<p className="text-center text-xs text-muted-foreground">
						You must be signed in as staff to claim this credential.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
