import {
	Database,
	FileCheck,
	KeyRound,
	Lock,
	Shield,
	ShieldCheck,
	Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
	title: 'Security & Compliance — VolunteerReady',
	description:
		'How VolunteerReady protects volunteer data, ensures FCRA compliance, and maintains trust across every organization.',
	openGraph: {
		title: 'Security & Compliance — VolunteerReady',
		description:
			'How VolunteerReady protects volunteer data, ensures FCRA compliance, and maintains trust across every organization.',
		images: [{ url: '/api/og/page/security', width: 1200, height: 630 }],
	},
};

const securityPractices = [
	{
		icon: Lock,
		heading: 'Encryption at rest and in transit',
		body: 'All data is encrypted in transit with TLS 1.3 and at rest using AES-256. Background check tokens from Checkr are additionally encrypted with application-level encryption before storage.',
	},
	{
		icon: ShieldCheck,
		heading: 'FCRA-compliant background checks',
		body: 'Our Checkr integration includes the full adverse action workflow required by the Fair Credit Reporting Act — pre-adverse notice, waiting period, and final adverse action. Organizations stay compliant without legal expertise.',
	},
	{
		icon: Users,
		heading: 'Multi-tenant data isolation',
		body: "Every database query is scoped to the requesting organization. Volunteers see only their own data. Organizations cannot access each other's applicant pools, screening results, or credentials.",
	},
	{
		icon: KeyRound,
		heading: 'Role-based access control',
		body: 'Team members get the minimum permissions they need. Admins, coordinators, and viewers see different things. Every role change and permission grant is logged.',
	},
	{
		icon: FileCheck,
		heading: 'Audit logging',
		body: 'Every significant action — application approvals, credential issuance, background check requests, team changes — is logged with timestamps, attribution, and before/after state.',
	},
	{
		icon: Database,
		heading: 'Data portability',
		body: "Organizations can export their data anytime via CSV. Volunteers own their portable credentials. We don't hold your data hostage — if you leave, your data leaves with you.",
	},
];

const complianceItems = [
	{
		label: 'FCRA (Fair Credit Reporting Act)',
		detail:
			'Full adverse action workflow for background checks: pre-adverse notice, mandatory waiting period, and final adverse action notice. Built into the screening flow — not an afterthought.',
	},
	{
		label: 'Soft delete and data retention',
		detail:
			'Records are soft-deleted, not permanently removed, ensuring audit trail integrity. Data retention policies align with legal requirements for employment and volunteer screening records.',
	},
	{
		label: 'Credential verification chain',
		detail:
			'Every portable credential tracks which organization issued it, when, and the evidence behind it. Credentials can be revoked with a full audit trail of the revocation.',
	},
	{
		label: 'Secure authentication',
		detail:
			'Authentication powered by NextAuth with Prisma adapter. Session management follows OWASP best practices. No password storage — OAuth providers handle credential security.',
	},
];

export default function SecurityPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Security', href: '/security' },
				]}
			/>
			<PublicHero
				eyebrow="Security & Compliance"
				heading={
					<>
						Trusted with your most{' '}
						<em className="italic text-primary">important data.</em>
					</>
				}
				description="VolunteerReady handles sensitive information — background checks, personal records, organizational data. Here's exactly how we protect it."
			/>

			{/* ── Security practices ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
				<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
					How we protect your data
				</h2>
				<p className="mb-12 text-muted-foreground">
					Security isn't a feature we added — it's how the platform was designed
					from day one.
				</p>
				<div className="flex flex-col gap-8">
					{securityPractices.map((s) => {
						const Icon = s.icon;
						return (
							<div key={s.heading} className="flex gap-5">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
									<Icon className="h-5 w-5 text-primary" />
								</div>
								<div>
									<p className="mb-1 text-lg font-semibold text-foreground">
										{s.heading}
									</p>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{s.body}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			{/* ── Compliance ── */}
			<section className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-[32px] font-bold text-foreground [text-wrap:balance]">
						Compliance and data governance
					</h2>
					<div className="flex flex-col gap-8">
						{complianceItems.map((c) => (
							<div key={c.label} className="border-l-2 border-primary/30 pl-6">
								<p className="font-semibold text-foreground">{c.label}</p>
								<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
									{c.detail}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Trust statement ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<FadeInOnScroll>
					<div className="rounded-xl border border-primary/20 bg-primary/5 p-8 sm:p-10">
						<Shield className="mb-4 h-8 w-8 text-primary" />
						<h2 className="font-display mb-3 text-2xl font-bold text-foreground [text-wrap:balance]">
							Our commitment
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							We know that nonprofits trust us with sensitive volunteer data,
							and volunteers trust us with their personal information. That
							trust is the foundation of everything we build. If you have
							questions about our security practices or need documentation for
							your compliance review, reach out — we're happy to help.
						</p>
						<div className="mt-6">
							<Button asChild variant="outline" className="rounded-full px-6">
								<TrackedLink
									href="mailto:security@volunteerready.com"
									eventLabel="Contact security team"
									eventPage="security"
								>
									Contact our security team
								</TrackedLink>
							</Button>
						</div>
					</div>
				</FadeInOnScroll>
			</section>

			<CTABanner
				icon={Shield}
				heading="Ready to get started?"
				description="Create a free account backed by enterprise-grade security. No credit card required."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="/login?callbackUrl=/app/onboarding"
							eventLabel="Get started (security)"
							eventPage="security"
						>
							Get started free
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
