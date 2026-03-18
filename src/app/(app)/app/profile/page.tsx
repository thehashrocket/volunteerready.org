'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	Briefcase,
	Building2,
	CalendarClock,
	CheckCircle2,
	CircleAlert,
	CircleDashed,
	Clock,
	Copy,
	ExternalLink,
	Link2,
	ShieldCheck,
	Sparkles,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getCredentialMeta } from '@/lib/credential-meta';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Interest chip-input (same pattern as SkillInput)
// ---------------------------------------------------------------------------

function ChipInput({
	items,
	onChange,
	max,
	placeholder,
}: {
	items: string[];
	onChange: (items: string[]) => void;
	max: number;
	placeholder: string;
}) {
	const [input, setInput] = useState('');

	function addItem(value: string) {
		const trimmed = value.trim().replace(/,+$/, '');
		if (!trimmed) return;
		if (items.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
		if (items.length >= max) return;
		onChange([...items, trimmed]);
		setInput('');
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addItem(input);
		} else if (e.key === 'Backspace' && !input && items.length > 0) {
			onChange(items.slice(0, -1));
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-1.5">
				{items.map((item) => (
					<span
						key={item}
						className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
					>
						{item}
						<button
							type="button"
							onClick={() => onChange(items.filter((s) => s !== item))}
							className="text-primary/60 hover:text-primary"
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				))}
			</div>
			<Input
				value={input}
				onChange={(e) => {
					const val = e.target.value;
					if (val.endsWith(',')) {
						addItem(val);
					} else {
						setInput(val);
					}
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => addItem(input)}
				placeholder={placeholder}
			/>
			<p className="text-xs text-muted-foreground">
				{items.length}/{max} — press Enter or comma to add
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Completeness indicator
// ---------------------------------------------------------------------------

function CompletenessBar({
	score,
	level,
	missing,
}: {
	score: number;
	level: string;
	missing: string[];
}) {
	const Icon =
		level === 'COMPLETE'
			? CheckCircle2
			: level === 'STRONG'
				? CheckCircle2
				: level === 'BASIC'
					? CircleDashed
					: CircleAlert;

	const color =
		level === 'COMPLETE'
			? 'text-success-foreground'
			: level === 'STRONG'
				? 'text-success'
				: level === 'BASIC'
					? 'text-warning'
					: 'text-muted-foreground';

	return (
		<Card>
			<CardContent className="py-4">
				<div className="flex items-center gap-3">
					<Icon className={`h-5 w-5 ${color}`} />
					<div className="flex-1">
						<div className="flex items-center justify-between text-sm font-medium">
							<span>Profile completeness</span>
							<span className={color}>{score}%</span>
						</div>
						<div className="mt-1 h-2 rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-primary transition-all"
								style={{ width: `${score}%` }}
							/>
						</div>
					</div>
				</div>
				{missing.length > 0 && (
					<p className="mt-2 text-xs text-muted-foreground">
						Missing: {missing.join(', ')}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const profileFormSchema = z.object({
	bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional(),
	phone: z.string().max(30).optional(),
	city: z.string().max(100).optional(),
	state: z.string().max(100).optional(),
	country: z.string().max(100).optional(),
	availability: z.enum(['FLEXIBLE', 'WEEKDAYS', 'WEEKENDS', 'EVENINGS']),
	visibility: z.enum(['PUBLIC', 'ORGS_ONLY', 'PRIVATE']),
	interests: z.array(z.string()).max(20),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
	const qc = useQueryClient();
	const query = trpc.profile.getMyProfile.useQuery();
	const statsQuery = trpc.profile.getMyStats.useQuery();

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			bio: '',
			phone: '',
			city: '',
			state: '',
			country: '',
			availability: 'FLEXIBLE',
			visibility: 'ORGS_ONLY',
			interests: [],
		},
	});

	// Sync server data into form once loaded
	useEffect(() => {
		if (query.data?.profile) {
			const p = query.data.profile;
			form.reset({
				bio: p.bio ?? '',
				phone: p.phone ?? '',
				city: p.city ?? '',
				state: p.state ?? '',
				country: p.country ?? '',
				availability:
					(p.availability as ProfileFormValues['availability']) ?? 'FLEXIBLE',
				visibility:
					(p.visibility as ProfileFormValues['visibility']) ?? 'ORGS_ONLY',
				interests: p.interests ?? [],
			});
		}
	}, [query.data, form]);

	const mutation = trpc.profile.updateMyProfile.useMutation({
		onSuccess: async () => {
			toast.success('Profile saved.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to save profile.');
		},
	});

	function onSubmit(values: ProfileFormValues) {
		mutation.mutate({
			bio: values.bio || null,
			phone: values.phone || null,
			city: values.city || null,
			state: values.state || null,
			country: values.country || null,
			availability: values.availability,
			visibility: values.visibility,
			interests: values.interests,
		});
	}

	const bio = form.watch('bio');

	if (query.isLoading) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<PageHeader
					title="My Profile"
					description="Manage your volunteer identity across organizations."
				/>
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground">
						Loading profile…
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<PageHeader
					title="My Profile"
					description="Manage your volunteer identity across organizations."
				/>
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<p className="text-sm text-destructive">{query.error.message}</p>
						<Button variant="outline" onClick={() => query.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const completeness = query.data?.completeness;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<PageHeader
				title="My Profile"
				description="Manage your volunteer identity across organizations."
			/>

			{completeness && (
				<CompletenessBar
					score={completeness.score}
					level={completeness.level}
					missing={completeness.missing}
				/>
			)}

			{/* Quick Stats */}
			{statsQuery.data && (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
					<Link href="/app/my-applications" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<Briefcase className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.applicationCount}
									</p>
									<p className="text-xs text-muted-foreground">Applications</p>
								</div>
							</CardContent>
						</Card>
					</Link>
					<Card>
						<CardContent className="flex items-center gap-3 py-3">
							<Building2 className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-lg font-semibold">
									{statsQuery.data.orgCount}
								</p>
								<p className="text-xs text-muted-foreground">Organizations</p>
							</div>
						</CardContent>
					</Card>
					<Link href="/app/my-skills" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<Sparkles className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.skillCount}
									</p>
									<p className="text-xs text-muted-foreground">Skills</p>
								</div>
							</CardContent>
						</Card>
					</Link>
					<Card>
						<CardContent className="flex items-center gap-3 py-3">
							<ShieldCheck className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-lg font-semibold">
									{statsQuery.data.credentialCount}
								</p>
								<p className="text-xs text-muted-foreground">Verified</p>
							</div>
						</CardContent>
					</Card>
					<Link href="/app/my-shifts" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<CalendarClock className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.upcomingShiftCount}
									</p>
									<p className="text-xs text-muted-foreground">Shifts</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>
			)}

			<Tabs defaultValue="profile">
				<TabsList className="w-full">
					<TabsTrigger value="profile" className="flex-1">
						Profile
					</TabsTrigger>
					<TabsTrigger value="credentials" className="flex-1">
						Credentials
					</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="space-y-6">
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						{/* About */}
						<Card>
							<CardHeader>
								<CardTitle>About</CardTitle>
								<CardDescription>
									Tell organizations a bit about yourself and why you volunteer.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="bio">Bio</Label>
									<Textarea
										id="bio"
										{...form.register('bio')}
										placeholder="A short bio about yourself…"
										maxLength={500}
										rows={4}
									/>
									{form.formState.errors.bio && (
										<p className="text-sm text-destructive">
											{form.formState.errors.bio.message}
										</p>
									)}
									<p className="text-right text-xs text-muted-foreground">
										{(bio ?? '').length}/500
									</p>
								</div>

								<div className="space-y-2">
									<Label>Interests</Label>
									<Controller
										control={form.control}
										name="interests"
										render={({ field }) => (
											<ChipInput
												items={field.value}
												onChange={field.onChange}
												max={20}
												placeholder="Type an interest and press Enter…"
											/>
										)}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Contact & Location */}
						<Card>
							<CardHeader>
								<CardTitle>Contact &amp; Location</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="phone">Phone</Label>
									<Input
										id="phone"
										{...form.register('phone')}
										placeholder="555-0123"
										maxLength={30}
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-3">
									<div className="space-y-2">
										<Label htmlFor="city">City</Label>
										<Input
											id="city"
											{...form.register('city')}
											placeholder="Portland"
											maxLength={100}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="state">State / Province</Label>
										<Input
											id="state"
											{...form.register('state')}
											placeholder="OR"
											maxLength={100}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="country">Country</Label>
										<Input
											id="country"
											{...form.register('country')}
											placeholder="US"
											maxLength={100}
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Preferences */}
						<Card>
							<CardHeader>
								<CardTitle>Preferences</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Availability</Label>
									<Controller
										control={form.control}
										name="availability"
										render={({ field }) => (
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="FLEXIBLE">Flexible</SelectItem>
													<SelectItem value="WEEKDAYS">Weekdays</SelectItem>
													<SelectItem value="WEEKENDS">Weekends</SelectItem>
													<SelectItem value="EVENINGS">Evenings</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
								</div>

								<div className="space-y-2">
									<Label>Profile visibility</Label>
									<Controller
										control={form.control}
										name="visibility"
										render={({ field }) => (
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="PUBLIC">
														Public — anyone can see
													</SelectItem>
													<SelectItem value="ORGS_ONLY">
														Organizations only — visible to orgs you've applied
														to
													</SelectItem>
													<SelectItem value="PRIVATE">
														Private — only you can see
													</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Save */}
						<div className="flex items-center gap-2 pb-8">
							<Button type="submit" disabled={mutation.isPending}>
								{mutation.isPending ? 'Saving…' : 'Save profile'}
							</Button>
						</div>
					</form>
				</TabsContent>

				<TabsContent value="credentials">
					<CredentialWallet />
				</TabsContent>
			</Tabs>
		</div>
	);
}

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
// Credential Wallet — full credential management with share links
// ---------------------------------------------------------------------------

function CredentialWallet() {
	const credQuery = trpc.credentials.getMyCredentials.useQuery();
	const tokensQuery = trpc.credentialSharing.listMyTokens.useQuery();
	const userIdQuery = trpc.profile.getMyUserId.useQuery();

	const generateMutation = trpc.credentialSharing.generate.useMutation({
		onSuccess: (data) => {
			const url = `${window.location.origin}/credentials/claim/${data.rawToken}`;
			navigator.clipboard.writeText(url).then(() => {
				toast.success('Share link copied to clipboard.');
			});
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to generate share link.');
		},
	});

	const revokeMutation = trpc.credentialSharing.revoke.useMutation({
		onSuccess: async () => {
			toast.success('Share link revoked.');
			await tokensQuery.refetch();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to revoke link.');
		},
	});

	if (credQuery.isLoading) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground">
					Loading credentials…
				</CardContent>
			</Card>
		);
	}

	const credentials = credQuery.data ?? [];
	const tokens = tokensQuery.data ?? [];

	if (credentials.length === 0) {
		return (
			<EmptyState
				icon={ShieldCheck}
				title="No credentials yet"
				description="Credentials will appear here once an organization verifies your background check, training, or other qualifications."
			/>
		);
	}

	const userId = userIdQuery.data?.userId;

	return (
		<div className="space-y-4">
			{/* Share card banner */}
			{userId && (
				<Card className="border-primary/20 bg-primary/5">
					<CardContent className="flex items-center justify-between gap-4 py-4">
						<div>
							<p className="font-medium text-sm">Share your volunteer card</p>
							<p className="text-xs text-muted-foreground">
								Your verified credentials and impact stats in one shareable
								link.
							</p>
						</div>
						<Button variant="outline" size="sm" asChild>
							<a
								href={`/v/${userId}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								View card
							</a>
						</Button>
					</CardContent>
				</Card>
			)}

			{credentials.map((cred) => {
				const meta = getCredentialMeta(cred.type);
				const Icon = meta.icon;
				const credTokens = tokens.filter(
					(t) => t.credentialId === cred.id && t.status === 'ACTIVE',
				);

				return (
					<Card key={cred.id}>
						<CardContent className="py-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">{meta.label}</span>
											<Badge variant={statusVariant[cred.status] ?? 'outline'}>
												{cred.status}
											</Badge>
										</div>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{cred.organization.name}
										</p>
										{cred.sharedFromOrg && (
											<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
												<Link2 className="h-3 w-3" />
												Shared from {cred.sharedFromOrg.name}
											</p>
										)}
										{cred.expiresAt && (
											<p className="mt-0.5 text-xs text-muted-foreground">
												Expires {new Date(cred.expiresAt).toLocaleDateString()}
											</p>
										)}
									</div>
								</div>

								{cred.status === 'VERIFIED' && (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											generateMutation.mutate({
												credentialId: cred.id,
											})
										}
										disabled={generateMutation.isPending}
									>
										<Copy className="mr-1 h-4 w-4" />
										Share
									</Button>
								)}
							</div>

							{/* Active share tokens for this credential */}
							{credTokens.length > 0 && (
								<div className="mt-3 space-y-2 border-t pt-3">
									<p className="text-xs font-medium text-muted-foreground">
										Active share links
									</p>
									{credTokens.map((token) => {
										const daysLeft = Math.max(
											0,
											Math.ceil(
												(new Date(token.expiresAt).getTime() - Date.now()) /
													(1000 * 60 * 60 * 24),
											),
										);
										return (
											<div
												key={token.id}
												className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs"
											>
												<span className="flex items-center gap-1.5">
													<Clock className="h-3 w-3" />
													<span
														className={
															daysLeft <= 7 ? 'font-medium text-amber-600' : ''
														}
													>
														{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
													</span>
												</span>
												<Button
													size="sm"
													variant="ghost"
													className="h-6 px-2 text-xs text-destructive hover:text-destructive"
													onClick={() =>
														revokeMutation.mutate({ tokenId: token.id })
													}
													disabled={revokeMutation.isPending}
												>
													Revoke
												</Button>
											</div>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
