'use client';

import {
	CheckCircle2,
	Fingerprint,
	GraduationCap,
	Loader2,
	Shield,
	Users,
	XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Credential type icons + labels
// ---------------------------------------------------------------------------

const CREDENTIAL_META: Record<string, { label: string; icon: typeof Shield }> =
	{
		BACKGROUND_CHECK: { label: 'Background Check', icon: Shield },
		TRAINING_COMPLETE: { label: 'Training Complete', icon: GraduationCap },
		ID_VERIFIED: { label: 'ID Verified', icon: Fingerprint },
		REFERENCE_CHECK: { label: 'Reference Check', icon: Users },
		ORIENTATION_COMPLETE: {
			label: 'Orientation Complete',
			icon: GraduationCap,
		},
	};

function getCredentialMeta(type: string) {
	return (
		CREDENTIAL_META[type] ?? { label: type.replace(/_/g, ' '), icon: Shield }
	);
}

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
			toast.error(err.message ?? 'Failed to claim credential.');
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
					<CardContent className="space-y-4 py-12 text-center">
						<XCircle className="mx-auto h-10 w-10 text-destructive" />
						<p className="text-sm text-muted-foreground">
							{infoQuery.error.message}
						</p>
						<Button variant="outline" asChild>
							<Link href="/">Go home</Link>
						</Button>
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
						<CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
						<h2 className="text-lg font-semibold">Credential claimed</h2>
						<p className="text-sm text-muted-foreground">
							The <span className="font-medium">{meta.label}</span> credential
							from <span className="font-medium">{info.issuingOrgName}</span>{' '}
							has been added to your organization.
						</p>
						<Button asChild>
							<Link href="/app/credentials">View credentials</Link>
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
