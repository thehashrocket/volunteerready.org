import { Award, Building2, Clock, MapPin, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getPublicProfile } from '@/server/services/volunteerIdentityService';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
	params,
}: {
	params: Promise<{ userId: string }>;
}): Promise<Metadata> {
	const { userId } = await params;
	const profile = await getPublicProfile(userId);
	if (!profile) {
		return { title: 'Volunteer Profile — VolunteerReady' };
	}
	const credCount = profile.credentials.length;
	const description =
		credCount > 0
			? `${profile.displayName} has ${credCount} verified credential${credCount !== 1 ? 's' : ''} and ${profile.totalHours} volunteer hours on VolunteerReady.`
			: `${profile.displayName} is a verified volunteer on VolunteerReady.`;
	return {
		title: `${profile.displayName} — VolunteerReady`,
		description,
		openGraph: {
			title: `${profile.displayName} — Verified Volunteer`,
			description,
			images: [`/api/share-card/${userId}`],
		},
		twitter: {
			card: 'summary_large_image',
			title: `${profile.displayName} — Verified Volunteer`,
			description,
			images: [`/api/share-card/${userId}`],
		},
	};
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VolunteerPublicProfilePage({
	params,
}: {
	params: Promise<{ userId: string }>;
}) {
	const { userId } = await params;
	const profile = await getPublicProfile(userId);

	// Both not-found and non-PUBLIC return the same 404 — no leakage.
	if (!profile) notFound();

	const location = [profile.city, profile.state].filter(Boolean).join(', ');
	const memberYear = new Date(profile.memberSince).getFullYear();

	return (
		<div className="min-h-screen bg-background">
			{/* Hero */}
			<section className="border-b border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-3xl">
					{/* Tenure badge */}
					{profile.tenureLevel !== 'NONE' && (
						<div className="mb-4">
							<Badge className="bg-accent/20 text-muted-foreground hover:bg-accent/20">
								<Award className="mr-1 h-3 w-3" />
								{profile.tenureLevel === '1YR' && '1 Year Volunteer'}
								{profile.tenureLevel === '3YR' && '3 Year Volunteer'}
								{profile.tenureLevel === '5YR' && '5+ Year Volunteer'}
							</Badge>
						</div>
					)}

					<h1 className="font-fraunces text-4xl font-bold text-foreground [text-wrap:balance] sm:text-5xl">
						{profile.displayName}
					</h1>

					{/* Location + member since */}
					<div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						{location && (
							<span className="flex items-center gap-1">
								<MapPin className="h-3.5 w-3.5" />
								{location}
							</span>
						)}
						<span>Member since {memberYear}</span>
					</div>

					{/* Bio */}
					{profile.bio && (
						<p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
							{profile.bio}
						</p>
					)}

					{/* Stats row */}
					<div className="mt-8 flex flex-wrap gap-6 border-t border-border pt-6">
						<Stat
							value={profile.totalHours}
							label="Hours served"
							empty={profile.totalHours === 0}
						/>
						<Stat
							value={profile.orgCount}
							label={profile.orgCount === 1 ? 'Organization' : 'Organizations'}
							empty={profile.orgCount === 0}
						/>
						<Stat
							value={profile.credentials.length}
							label={
								profile.credentials.length === 1 ? 'Credential' : 'Credentials'
							}
							empty={profile.credentials.length === 0}
						/>
						{profile.reliabilityScore !== null && (
							<Stat
								value={`${profile.reliabilityScore}%`}
								label="Reliability score"
								emphasize
							/>
						)}
					</div>
				</div>
			</section>

			{/* Credentials */}
			<section className="px-4 py-10 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-3xl">
					{profile.credentials.length === 0 ? (
						<Card>
							<CardContent className="py-10 text-center">
								<ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
								<p className="text-sm italic text-muted-foreground/60">
									Just getting started — credentials will appear here once
									earned.
								</p>
							</CardContent>
						</Card>
					) : (
						<>
							<h2 className="mb-4 font-fraunces text-xl font-semibold text-foreground">
								Verified credentials
							</h2>
							<div className="grid gap-3 sm:grid-cols-2">
								{profile.credentials.map((cred, i) => (
									<CredentialCard key={i} credential={cred} />
								))}
							</div>
						</>
					)}
				</div>
			</section>

			{/* Footer CTA */}
			<section className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-3xl">
					<p className="text-sm text-muted-foreground/60">
						This profile is verified by{' '}
						<Link href="/" className="text-primary hover:underline">
							VolunteerReady
						</Link>
						.
					</p>
				</div>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stat({
	value,
	label,
	empty = false,
	emphasize = false,
}: {
	value: number | string;
	label: string;
	empty?: boolean;
	emphasize?: boolean;
}) {
	return (
		<div>
			<p
				className={`font-tabular-nums text-2xl font-bold tabular-nums ${
					empty
						? 'text-muted-foreground/40'
						: emphasize
							? 'text-primary'
							: 'text-foreground'
				}`}
			>
				{empty ? '—' : value}
			</p>
			<p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground/60">
				{label}
			</p>
		</div>
	);
}

function CredentialCard({
	credential,
}: {
	credential: {
		type: string;
		label: string;
		issuedAt: Date | null;
		orgName: string;
	};
}) {
	const issuedYear = credential.issuedAt
		? new Date(credential.issuedAt).getFullYear()
		: null;

	return (
		<div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
			<div className="mt-0.5 shrink-0">
				<ShieldCheck className="h-4 w-4 text-primary" />
			</div>
			<div className="min-w-0">
				<p className="text-sm font-medium text-foreground">
					{credential.label}
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-2">
					<span className="flex items-center gap-1 text-xs text-muted-foreground">
						<Building2 className="h-3 w-3" />
						{credential.orgName}
					</span>
					{issuedYear && (
						<span className="flex items-center gap-1 text-xs text-muted-foreground/60">
							<Clock className="h-3 w-3" />
							{issuedYear}
						</span>
					)}
				</div>
			</div>
			<Badge className="ml-auto shrink-0 bg-primary text-xs text-white hover:bg-primary">
				Verified
			</Badge>
		</div>
	);
}
