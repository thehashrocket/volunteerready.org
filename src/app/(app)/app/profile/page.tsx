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
	ShieldCheck,
	Sparkles,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
	bio: z.string().max(500, 'Bio must be 500 characters or fewer').default(''),
	phone: z.string().max(30).default(''),
	city: z.string().max(100).default(''),
	state: z.string().max(100).default(''),
	country: z.string().max(100).default(''),
	availability: z
		.enum(['FLEXIBLE', 'WEEKDAYS', 'WEEKENDS', 'EVENINGS'])
		.default('FLEXIBLE'),
	visibility: z.enum(['PUBLIC', 'ORGS_ONLY', 'PRIVATE']).default('ORGS_ONLY'),
	interests: z.array(z.string()).max(20).default([]),
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
								{bio.length}/500
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
									<Select value={field.value} onValueChange={field.onChange}>
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
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="PUBLIC">
												Public — anyone can see
											</SelectItem>
											<SelectItem value="ORGS_ONLY">
												Organizations only — visible to orgs you've applied to
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

			{/* Credentials (read-only for volunteer) */}
			<CredentialsCard />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Volunteer credential read-only view
// ---------------------------------------------------------------------------

function CredentialsCard() {
	const query = trpc.credentials.getMyCredentials.useQuery();

	if (query.isLoading || !query.data || query.data.length === 0) return null;

	const statusVariant: Record<
		string,
		'success' | 'warning' | 'neutral' | 'destructive'
	> = {
		VERIFIED: 'success',
		PENDING: 'warning',
		EXPIRED: 'neutral',
		REVOKED: 'destructive',
	};

	const typeLabels: Record<string, string> = {
		BACKGROUND_CHECK: 'Background Check',
		TRAINING_COMPLETE: 'Training Complete',
		ID_VERIFIED: 'ID Verified',
		REFERENCE_CHECK: 'Reference Check',
		ORIENTATION_COMPLETE: 'Orientation Complete',
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Credentials</CardTitle>
				<CardDescription>
					Verification badges issued by organizations you volunteer with.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{query.data.map((cred) => (
						<div
							key={cred.id}
							className="flex items-center justify-between rounded-md border px-3 py-2"
						>
							<span className="text-sm font-medium">
								{typeLabels[cred.type] ?? cred.type}
							</span>
							<Badge variant={statusVariant[cred.status] ?? 'outline'}>
								{cred.status}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
