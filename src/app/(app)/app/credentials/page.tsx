'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { trpc } from '@/lib/trpc/client';

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

function IssueCredentialDialog() {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);

	const form = useForm<IssueFormValues>({
		resolver: zodResolver(issueSchema),
		defaultValues: {
			userId: '',
			type: 'BACKGROUND_CHECK',
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
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to issue credential.');
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
// Page
// ---------------------------------------------------------------------------

export default function CredentialsPage() {
	const qc = useQueryClient();
	const query = trpc.credentials.listOrgCredentials.useQuery();

	const revokeMutation = trpc.credentials.revoke.useMutation({
		onSuccess: async () => {
			toast.success('Credential revoked.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to revoke.');
		},
	});

	const removeMutation = trpc.credentials.remove.useMutation({
		onSuccess: async () => {
			toast.success('Credential removed.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to remove.');
		},
	});

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Credentials"
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
					title="Credentials"
					description="Manage volunteer verifications."
				/>
				<Card>
					<CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
						<p className="text-destructive">{query.error.message}</p>
						<Button variant="outline" size="sm" onClick={() => query.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
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
				title="Credentials"
				description="Issue and manage volunteer verification badges."
				actions={<IssueCredentialDialog />}
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
		</div>
	);
}
