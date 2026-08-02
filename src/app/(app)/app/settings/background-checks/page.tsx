'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	AlertTriangle,
	CheckCircle2,
	ClipboardCheck,
	FileWarning,
	Key,
	Link2,
	Link2Off,
	Plus,
	ShieldCheck,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc/client';
import { getPlanLimits } from '@/server/domain/billing';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDENTIAL_TYPES = [
	{ value: 'BACKGROUND_CHECK', label: 'Background Check' },
	{ value: 'TRAINING_COMPLETE', label: 'Training Complete' },
	{ value: 'ID_VERIFIED', label: 'ID Verified' },
	{ value: 'REFERENCE_CHECK', label: 'Reference Check' },
	{ value: 'ORIENTATION_COMPLETE', label: 'Orientation Complete' },
] as const;

const CREDENTIAL_STATUSES = [
	{ value: 'PENDING', label: 'Pending' },
	{ value: 'VERIFIED', label: 'Verified' },
	{ value: 'EXPIRED', label: 'Expired' },
	{ value: 'REVOKED', label: 'Revoked' },
] as const;

type CredentialType = (typeof CREDENTIAL_TYPES)[number]['value'];

const statusVariant: Record<
	string,
	'success' | 'warning' | 'neutral' | 'destructive'
> = {
	VERIFIED: 'success',
	PENDING: 'warning',
	EXPIRED: 'neutral',
	REVOKED: 'destructive',
};

const bgCheckStatusVariant: Record<
	string,
	'success' | 'warning' | 'neutral' | 'destructive'
> = {
	PENDING: 'warning',
	COMPLETE: 'success',
	CONSIDER: 'warning',
	FAILED: 'destructive',
	CANCELLED: 'neutral',
};

const fcraStatusLabel: Record<string, string> = {
	NONE: '',
	PRE_ADVERSE_SENT: 'Pre-Adverse Sent',
	ADVERSE_ACTION_SENT: 'Adverse Action',
	RESOLVED: 'Resolved',
};

const fcraStatusVariant: Record<
	string,
	'success' | 'warning' | 'neutral' | 'destructive'
> = {
	PRE_ADVERSE_SENT: 'warning',
	ADVERSE_ACTION_SENT: 'destructive',
	RESOLVED: 'success',
};

// ---------------------------------------------------------------------------
// Issue Credential Dialog – react-hook-form + zod
// ---------------------------------------------------------------------------

const issueSchema = z.object({
	userId: z.string().min(1, 'Volunteer User ID is required'),
	type: z.enum([
		'BACKGROUND_CHECK',
		'TRAINING_COMPLETE',
		'ID_VERIFIED',
		'REFERENCE_CHECK',
		'ORIENTATION_COMPLETE',
	]),
	status: z.enum(['PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED']),
	notes: z.string().max(500).optional(),
	expiresAt: z.string().optional(),
});

type IssueFormValues = z.infer<typeof issueSchema>;

function IssueCredentialDialog({
	defaultUserId,
	defaultType,
	onIssued,
}: {
	defaultUserId?: string;
	defaultType?: CredentialType;
	onIssued?: () => void;
} = {}) {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);

	const form = useForm<IssueFormValues>({
		resolver: zodResolver(issueSchema),
		defaultValues: {
			userId: defaultUserId ?? '',
			type: defaultType ?? 'BACKGROUND_CHECK',
			status: 'VERIFIED',
			notes: '',
			expiresAt: '',
		},
	});

	const mutation = trpc.credentials.issue.useMutation({
		onSuccess: async () => {
			toast.success('Credential issued.');
			await qc.invalidateQueries();
			setOpen(false);
			form.reset();
			onIssued?.();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to issue credential.');
		},
	});

	function onSubmit(values: IssueFormValues) {
		mutation.mutate({
			userId: values.userId,
			type: values.type,
			status: values.status,
			notes: values.notes || null,
			expiresAt: values.expiresAt ? new Date(values.expiresAt) : null,
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus className="mr-1 h-4 w-4" />
					Issue Credential
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Issue Credential</DialogTitle>
					<DialogDescription>
						Add or update a verification badge for a volunteer.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="userId">Volunteer User ID</Label>
						<Input
							id="userId"
							placeholder="cuid…"
							{...form.register('userId')}
						/>
						{form.formState.errors.userId && (
							<p className="text-xs text-destructive">
								{form.formState.errors.userId.message}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<Label>Type</Label>
						<Select
							value={form.watch('type')}
							onValueChange={(v) =>
								form.setValue('type', v as IssueFormValues['type'])
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CREDENTIAL_TYPES.map((t) => (
									<SelectItem key={t.value} value={t.value}>
										{t.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Status</Label>
						<Select
							value={form.watch('status')}
							onValueChange={(v) =>
								form.setValue('status', v as IssueFormValues['status'])
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CREDENTIAL_STATUSES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="expiresAt">Expires (optional)</Label>
						<Input id="expiresAt" type="date" {...form.register('expiresAt')} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="notes">Notes (optional)</Label>
						<Textarea
							id="notes"
							maxLength={500}
							rows={2}
							{...form.register('notes')}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? 'Issuing…' : 'Issue'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Review & Issue Dialog — CONSIDER row action (atomic credential + FCRA)
// ---------------------------------------------------------------------------

const reviewIssueSchema = z.object({
	notes: z.string().max(500).optional(),
	expiresAt: z.string().optional(),
});

type ReviewIssueFormValues = z.infer<typeof reviewIssueSchema>;

function ReviewIssueDialog({
	requestId,
	volunteerName,
}: {
	requestId: string;
	volunteerName: string;
}) {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);

	const form = useForm<ReviewIssueFormValues>({
		resolver: zodResolver(reviewIssueSchema),
		defaultValues: { notes: '', expiresAt: '' },
	});

	const mutation = trpc.backgroundChecks.issueAndResolve.useMutation({
		onSuccess: async () => {
			toast.success('Credential issued and background check resolved.');
			await qc.invalidateQueries();
			setOpen(false);
			form.reset();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to issue credential.');
		},
	});

	function onSubmit(values: ReviewIssueFormValues) {
		mutation.mutate({
			requestId,
			notes: values.notes || null,
			expiresAt: values.expiresAt
				? new Date(`${values.expiresAt}T23:59:59`)
				: null,
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" variant="default">
					<ClipboardCheck className="mr-1 h-4 w-4" />
					Review &amp; Issue
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Review &amp; Issue Credential</DialogTitle>
					<DialogDescription>
						Issue a verified Background Check credential for{' '}
						<span className="font-medium text-foreground">{volunteerName}</span>{' '}
						and resolve the FCRA review.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="rounded-md border bg-muted/50 p-3">
						<div className="flex items-center gap-2 text-sm">
							<ShieldCheck className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Type:</span>
							<span className="font-medium">Background Check</span>
						</div>
						<div className="mt-1 flex items-center gap-2 text-sm">
							<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Status:</span>
							<Badge variant="success">Verified</Badge>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="review-expiresAt">Expires (optional)</Label>
						<Input
							id="review-expiresAt"
							type="date"
							min={new Date().toISOString().split('T')[0]}
							{...form.register('expiresAt')}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="review-notes">Notes (optional)</Label>
						<Textarea
							id="review-notes"
							maxLength={500}
							rows={2}
							placeholder="e.g., Clear result with minor record noted"
							{...form.register('notes')}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? 'Issuing…' : 'Issue Credential'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Initiate Background Check Dialog
// ---------------------------------------------------------------------------

const bgCheckSchema = z.object({
	userId: z.string().min(1, 'Volunteer User ID is required'),
	firstName: z.string().min(1, 'Required').max(100),
	lastName: z.string().min(1, 'Required').max(100),
	email: z.string().email('Valid email required'),
	dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
	ssn: z.string().regex(/^\d{9}$/, 'Must be exactly 9 digits, no dashes'),
	packageName: z.string().optional(),
	// Client-side half of Guard 0 in backgroundCheckService.ts. The server
	// refuses independently — this exists so the refusal lands as a field error
	// next to the checkbox instead of a toast after a round trip.
	consentAttested: z
		.boolean()
		.refine((v) => v, 'Confirm you have the volunteer’s signed authorization.'),
});

type BgCheckFormValues = z.infer<typeof bgCheckSchema>;

function InitiateBackgroundCheckDialog({
	canBackgroundChecks,
}: {
	canBackgroundChecks: boolean;
}) {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);

	const form = useForm<BgCheckFormValues>({
		resolver: zodResolver(bgCheckSchema),
		defaultValues: {
			userId: '',
			firstName: '',
			lastName: '',
			email: '',
			dob: '',
			ssn: '',
			packageName: '',
			consentAttested: false,
		},
	});

	const mutation = trpc.backgroundChecks.initiate.useMutation({
		onSuccess: async () => {
			toast.success(
				'Background check initiated. Results will arrive via webhook.',
			);
			await qc.invalidateQueries();
			setOpen(false);
			form.reset();
		},
		onError: (err) => {
			toast.error(
				safeErrorMessage(err) ?? 'Failed to initiate background check.',
			);
		},
	});

	function onSubmit(values: BgCheckFormValues) {
		mutation.mutate({
			userId: values.userId,
			pii: {
				firstName: values.firstName,
				lastName: values.lastName,
				email: values.email,
				dob: values.dob,
				ssn: values.ssn,
			},
			packageName: values.packageName || undefined,
			consentAttested: values.consentAttested,
		});
	}

	const trigger = canBackgroundChecks ? (
		<Button size="sm" variant="outline">
			<ShieldCheck className="mr-1 h-4 w-4" />
			Run Background Check
		</Button>
	) : (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex">
						<Button size="sm" variant="outline" disabled>
							<ShieldCheck className="mr-1 h-4 w-4" />
							Run Background Check
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>
					Upgrade to PRO to run background checks.
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);

	if (!canBackgroundChecks) return trigger;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Initiate Background Check</DialogTitle>
					<DialogDescription>
						Run a Checkr background check for a volunteer. Results arrive
						asynchronously via webhook.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					{/* Volunteer ID */}
					<div className="space-y-2">
						<Label htmlFor="bg-userId">Volunteer User ID</Label>
						<Input
							id="bg-userId"
							placeholder="cuid…"
							{...form.register('userId')}
						/>
						{form.formState.errors.userId && (
							<p className="text-xs text-destructive">
								{form.formState.errors.userId.message}
							</p>
						)}
					</div>

					{/* Name */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="bg-firstName">First Name</Label>
							<Input id="bg-firstName" {...form.register('firstName')} />
							{form.formState.errors.firstName && (
								<p className="text-xs text-destructive">
									{form.formState.errors.firstName.message}
								</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="bg-lastName">Last Name</Label>
							<Input id="bg-lastName" {...form.register('lastName')} />
							{form.formState.errors.lastName && (
								<p className="text-xs text-destructive">
									{form.formState.errors.lastName.message}
								</p>
							)}
						</div>
					</div>

					{/* Email */}
					<div className="space-y-2">
						<Label htmlFor="bg-email">Email</Label>
						<Input id="bg-email" type="email" {...form.register('email')} />
						{form.formState.errors.email && (
							<p className="text-xs text-destructive">
								{form.formState.errors.email.message}
							</p>
						)}
					</div>

					{/* DOB */}
					<div className="space-y-2">
						<Label htmlFor="bg-dob">Date of Birth</Label>
						<Input id="bg-dob" type="date" {...form.register('dob')} />
						{form.formState.errors.dob && (
							<p className="text-xs text-destructive">
								{form.formState.errors.dob.message}
							</p>
						)}
					</div>

					{/* SSN — type="password" prevents screen recording */}
					<div className="space-y-2">
						<Label htmlFor="bg-ssn">SSN (9 digits, no dashes)</Label>
						<Input
							id="bg-ssn"
							type="password"
							autoComplete="new-password"
							placeholder="•••••••••"
							maxLength={9}
							{...form.register('ssn')}
						/>
						{form.formState.errors.ssn && (
							<p className="text-xs text-destructive">
								{form.formState.errors.ssn.message}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							SSN is sent directly to our background check provider and is never
							stored by VolunteerReady.
						</p>
					</div>

					{/*
					 * FCRA consent attestation — the client half of Guard 0.
					 *
					 * `ui/checkbox` is a native <input type="checkbox">, not the Radix
					 * primitive, so plain `register` yields the boolean directly and no
					 * controlled wiring is needed.
					 */}
					<div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
						<div className="flex items-start gap-3">
							<Checkbox
								id="bg-consent"
								className="mt-0.5"
								{...form.register('consentAttested')}
							/>
							<Label
								htmlFor="bg-consent"
								className="text-sm font-normal leading-snug"
							>
								I have this volunteer&apos;s signed background check disclosure
								and authorization on file.
							</Label>
						</div>
						{form.formState.errors.consentAttested && (
							<p className="text-xs text-destructive">
								{form.formState.errors.consentAttested.message}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Required by the FCRA before a check is run. We&apos;ll email the
							volunteer to let them know the check has started.
						</p>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? 'Submitting…' : 'Submit'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Checkr Connect Card — Partner API OAuth connect/disconnect
// ---------------------------------------------------------------------------

function CheckrConnectCard() {
	const qc = useQueryClient();
	const statusQ = trpc.backgroundChecks.getCheckrStatus.useQuery();
	const oauthUrlQ = trpc.backgroundChecks.getCheckrOAuthUrl.useQuery(
		undefined,
		{ enabled: false }, // only fetch on demand
	);

	const disconnectMutation = trpc.backgroundChecks.disconnectCheckr.useMutation(
		{
			onSuccess: async () => {
				toast.success('Checkr account disconnected.');
				await qc.invalidateQueries();
			},
			onError: (err) => {
				toast.error(safeErrorMessage(err) ?? 'Failed to disconnect Checkr.');
			},
		},
	);

	function handleConnect() {
		oauthUrlQ.refetch().then((result) => {
			if (result.data?.url) {
				window.location.href = result.data.url;
			} else if (result.error) {
				toast.error('Failed to initiate Checkr connection. Please try again.');
			}
		});
	}

	const connected = statusQ.data?.connected ?? false;
	const accountId = statusQ.data?.accountId;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							Checkr Integration
						</CardTitle>
						<CardDescription>
							Connect your organization&apos;s Checkr account to run automated
							background checks.
						</CardDescription>
					</div>
					{connected && (
						<Badge variant="success" className="flex items-center gap-1">
							<CheckCircle2 className="h-3 w-3" />
							Connected
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{statusQ.isLoading ? (
					<div className="space-y-2">
						<div className="h-4 w-48 animate-pulse rounded bg-muted" />
						<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					</div>
				) : connected ? (
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Account ID: <span className="font-mono text-xs">{accountId}</span>
						</p>
						<Button
							size="sm"
							variant="outline"
							className="text-destructive hover:text-destructive"
							onClick={() => disconnectMutation.mutate()}
							disabled={disconnectMutation.isPending}
						>
							<Link2Off className="mr-1 h-4 w-4" />
							{disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
						</Button>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							No Checkr account connected. Connect to enable automated
							background checks for your volunteers.
						</p>
						<Button
							size="sm"
							onClick={handleConnect}
							disabled={oauthUrlQ.isFetching}
						>
							<Link2 className="mr-1 h-4 w-4" />
							{oauthUrlQ.isFetching ? 'Redirecting…' : 'Connect Checkr'}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Sterling Connect Card — API key paste (no OAuth)
// ---------------------------------------------------------------------------

function SterlingConnectCard() {
	const qc = useQueryClient();
	const statusQ = trpc.backgroundChecks.getSterlingStatus.useQuery();
	const [apiKey, setApiKey] = useState('');
	const [accountId, setAccountId] = useState('');

	const connectMutation = trpc.backgroundChecks.connectSterling.useMutation({
		onSuccess: async () => {
			toast.success('Sterling account connected.');
			setApiKey('');
			setAccountId('');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to connect Sterling.');
		},
	});

	const disconnectMutation =
		trpc.backgroundChecks.disconnectSterling.useMutation({
			onSuccess: async () => {
				toast.success('Sterling account disconnected.');
				await qc.invalidateQueries();
			},
			onError: (err) => {
				toast.error(safeErrorMessage(err) ?? 'Failed to disconnect Sterling.');
			},
		});

	function handleConnect(e: React.FormEvent) {
		e.preventDefault();
		if (!apiKey.trim() || !accountId.trim()) {
			toast.error('Both API key and Account ID are required.');
			return;
		}
		connectMutation.mutate({
			apiKey: apiKey.trim(),
			accountId: accountId.trim(),
		});
	}

	const connected = statusQ.data?.connected ?? false;
	const storedAccountId = statusQ.data?.accountId;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Key className="h-5 w-5" />
							Sterling Integration
						</CardTitle>
						<CardDescription>
							Connect your organization&apos;s Sterling account to run automated
							background checks via Sterling.
						</CardDescription>
					</div>
					{connected && (
						<Badge variant="success" className="flex items-center gap-1">
							<CheckCircle2 className="h-3 w-3" />
							Connected
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{statusQ.isLoading ? (
					<div className="space-y-2">
						<div className="h-4 w-48 animate-pulse rounded bg-muted" />
						<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					</div>
				) : connected ? (
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Account ID:{' '}
							<span className="font-mono text-xs">{storedAccountId}</span>
						</p>
						<Button
							size="sm"
							variant="outline"
							className="text-destructive hover:text-destructive"
							onClick={() => disconnectMutation.mutate()}
							disabled={disconnectMutation.isPending}
						>
							<Link2Off className="mr-1 h-4 w-4" />
							{disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
						</Button>
					</div>
				) : (
					<form onSubmit={handleConnect} className="space-y-3">
						<p className="text-sm text-muted-foreground">
							No Sterling account connected. Enter your Sterling API key and
							Account ID to enable automated background checks.
						</p>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<Label htmlFor="sterling-account-id">Account ID</Label>
								<Input
									id="sterling-account-id"
									placeholder="acct_..."
									value={accountId}
									onChange={(e) => setAccountId(e.target.value)}
								/>
							</div>
							<div className="space-y-1">
								<Label htmlFor="sterling-api-key">API Key</Label>
								<Input
									id="sterling-api-key"
									type="password"
									placeholder="sk_..."
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
								/>
							</div>
						</div>
						<div className="flex justify-end">
							<Button
								type="submit"
								size="sm"
								disabled={
									connectMutation.isPending ||
									!apiKey.trim() ||
									!accountId.trim()
								}
							>
								<Key className="mr-1 h-4 w-4" />
								{connectMutation.isPending ? 'Connecting…' : 'Connect Sterling'}
							</Button>
						</div>
					</form>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Background Check Requests Table
// ---------------------------------------------------------------------------

function BackgroundCheckRequestsTable() {
	const qc = useQueryClient();
	const query = trpc.backgroundChecks.listByOrg.useQuery();

	const cancelMutation = trpc.backgroundChecks.cancel.useMutation({
		onSuccess: async () => {
			toast.success('Background check cancelled.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to cancel.');
		},
	});

	const preAdverseMutation =
		trpc.backgroundChecks.sendPreAdverseNotice.useMutation({
			onSuccess: async () => {
				toast.success('Pre-adverse action notice sent to volunteer.');
				await qc.invalidateQueries();
			},
			onError: (err) => {
				toast.error(
					safeErrorMessage(err) ??
						'Failed to send pre-adverse notice. Please retry.',
				);
			},
		});

	const adverseActionMutation =
		trpc.backgroundChecks.finalizeAdverseAction.useMutation({
			onSuccess: async () => {
				toast.success('Adverse action finalized.');
				await qc.invalidateQueries();
			},
			onError: (err) => {
				toast.error(
					safeErrorMessage(err) ?? 'Failed to finalize adverse action.',
				);
			},
		});

	if (query.isLoading) {
		return (
			<Card>
				<CardContent className="space-y-2 pt-6">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	const requests = (query.data ?? []) as NonNullable<typeof query.data>;

	if (requests.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Background Check Requests</CardTitle>
					<CardDescription>
						No background checks have been initiated yet.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Background Check Requests</CardTitle>
				<CardDescription>
					{requests.length} request{requests.length !== 1 ? 's' : ''}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Volunteer</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>FCRA</TableHead>
							<TableHead>Provider</TableHead>
							<TableHead>Initiated</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{requests.map((req) => {
							const fcra = req.fcraStatus ?? 'NONE';
							const isConsider = req.status === 'CONSIDER';
							const canSendPreAdverse = isConsider && fcra === 'NONE';
							const canFinalize = isConsider && fcra === 'PRE_ADVERSE_SENT';
							const canIssueCredential =
								isConsider && (fcra === 'NONE' || fcra === 'PRE_ADVERSE_SENT');

							return (
								<TableRow key={req.id}>
									<TableCell>
										<div>
											<p className="font-medium text-sm">
												{req.user.name ?? 'Unknown'}
											</p>
											<p className="text-xs text-muted-foreground">
												{req.user.email}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={bgCheckStatusVariant[req.status] ?? 'outline'}
										>
											{req.status === 'CONSIDER' ? 'Needs Review' : req.status}
										</Badge>
									</TableCell>
									<TableCell>
										{fcra !== 'NONE' && (
											<Badge variant={fcraStatusVariant[fcra] ?? 'outline'}>
												{fcraStatusLabel[fcra] ?? fcra}
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{req.provider}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{new Date(req.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex flex-wrap justify-end gap-1">
											{/* CONSIDER + FCRA NONE → Send Pre-Adverse Notice */}
											{canSendPreAdverse && (
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														preAdverseMutation.mutate({
															requestId: req.id,
														})
													}
													disabled={preAdverseMutation.isPending}
												>
													<FileWarning className="mr-1 h-4 w-4" />
													{preAdverseMutation.isPending
														? 'Sending…'
														: 'Pre-Adverse Notice'}
												</Button>
											)}

											{/* CONSIDER + PRE_ADVERSE_SENT → Finalize Adverse Action */}
											{canFinalize && (
												<Button
													size="sm"
													variant="destructive"
													onClick={() =>
														adverseActionMutation.mutate({
															requestId: req.id,
														})
													}
													disabled={adverseActionMutation.isPending}
												>
													<AlertTriangle className="mr-1 h-4 w-4" />
													{adverseActionMutation.isPending
														? 'Finalizing…'
														: 'Finalize Adverse Action'}
												</Button>
											)}

											{/* CONSIDER → Review & Issue (atomic credential + FCRA) */}
											{canIssueCredential && (
												<ReviewIssueDialog
													requestId={req.id}
													volunteerName={req.user.name ?? 'Unknown'}
												/>
											)}

											{/* PENDING or CONSIDER → Cancel */}
											{(req.status === 'PENDING' ||
												req.status === 'CONSIDER') && (
												<Button
													size="sm"
													variant="ghost"
													className="text-destructive hover:text-destructive"
													onClick={() =>
														cancelMutation.mutate({
															requestId: req.id,
														})
													}
													disabled={cancelMutation.isPending}
												>
													<XCircle className="mr-1 h-4 w-4" />
													Cancel
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CredentialsPage() {
	const qc = useQueryClient();
	const query = trpc.credentials.listOrgCredentials.useQuery();
	const billingQ = trpc.billing.getBillingStatus.useQuery();
	const searchParams = useSearchParams();

	// Show toast after Checkr OAuth callback redirect (run once on mount)
	useEffect(() => {
		const checkrConnected = searchParams.get('checkr_connected');
		const checkrError = searchParams.get('checkr_error');
		if (checkrConnected === 'true') {
			toast.success('Checkr account connected successfully.');
		} else if (checkrError) {
			const messages: Record<string, string> = {
				authorization_denied: 'Checkr authorization was denied.',
				missing_params: 'Checkr OAuth callback missing required parameters.',
				state_mismatch: 'Security check failed. Please try connecting again.',
				token_exchange_failed: 'Failed to connect Checkr. Please try again.',
			};
			toast.error(
				messages[checkrError] ?? `Checkr connection error: ${checkrError}`,
			);
		}
	}, [searchParams]);

	const revokeMutation = trpc.credentials.revoke.useMutation({
		onSuccess: async () => {
			toast.success('Credential revoked.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to revoke.');
		},
	});

	const removeMutation = trpc.credentials.remove.useMutation({
		onSuccess: async () => {
			toast.success('Credential removed.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to remove.');
		},
	});

	const planTier = billingQ.data?.planTier ?? 'FREE';
	const canBackgroundChecks = getPlanLimits(planTier).canBackgroundChecks;

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Background checks"
					description="Manage volunteer verifications."
				/>
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Background checks"
					description="Manage volunteer verifications."
				/>
				<QueryErrorCard
					title="Couldn't load background checks"
					message={safeErrorMessage(query.error)}
					onRetry={() => query.refetch()}
					isRetrying={query.isFetching}
				/>
			</div>
		);
	}

	const credentials = query.data ?? [];
	const typeLabel = Object.fromEntries(
		CREDENTIAL_TYPES.map((t) => [t.value, t.label]),
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Background checks"
				description="Issue and manage volunteer verification badges."
				actions={
					<div className="flex gap-2">
						<InitiateBackgroundCheckDialog
							canBackgroundChecks={canBackgroundChecks}
						/>
						<IssueCredentialDialog />
					</div>
				}
			/>

			{credentials.length === 0 ? (
				<EmptyState
					icon={ShieldCheck}
					title="No credentials yet"
					description="Issue a verification badge to a volunteer to get started."
				/>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>All Credentials</CardTitle>
						<CardDescription>
							{credentials.length} credential
							{credentials.length !== 1 ? 's' : ''} issued
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Volunteer</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{credentials.map((cred) => (
									<TableRow key={cred.id}>
										<TableCell>
											<div>
												<p className="font-medium text-sm">
													{cred.user.name ?? 'Unknown'}
												</p>
												<p className="text-xs text-muted-foreground">
													{cred.user.email}
												</p>
											</div>
										</TableCell>
										<TableCell className="text-sm">
											{typeLabel[cred.type] ?? cred.type}
										</TableCell>
										<TableCell>
											<Badge variant={statusVariant[cred.status] ?? 'outline'}>
												{cred.status}
											</Badge>
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{cred.expiresAt
												? new Date(cred.expiresAt).toLocaleDateString()
												: '—'}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												{cred.status === 'VERIFIED' && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															revokeMutation.mutate({
																userId: cred.userId,
																type: cred.type as CredentialType,
															})
														}
														disabled={revokeMutation.isPending}
													>
														Revoke
													</Button>
												)}
												<Button
													size="sm"
													variant="ghost"
													className="text-destructive hover:text-destructive"
													onClick={() =>
														removeMutation.mutate({
															userId: cred.userId,
															type: cred.type as CredentialType,
														})
													}
													disabled={removeMutation.isPending}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Background Check Provider Connections */}
			<CheckrConnectCard />
			<SterlingConnectCard />

			{/* Background Check Requests — shown below credentials */}
			<BackgroundCheckRequestsTable />
		</div>
	);
}
