import {
	Eye,
	FileText,
	Lock,
	Mail,
	Settings,
	Share2,
	ShieldAlert,
	Trash2,
	UserCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';

export const metadata: Metadata = {
	title: 'Privacy Policy — VolunteerReady',
	description:
		'How VolunteerReady collects, uses, stores, and protects your data.',
	openGraph: {
		title: 'Privacy Policy — VolunteerReady',
		description:
			'How VolunteerReady collects, uses, stores, and protects your data.',
		images: [{ url: '/api/og/page/privacy', width: 1200, height: 630 }],
	},
};

const sections = [
	{ id: 'information-we-collect', label: 'Information We Collect' },
	{ id: 'how-we-use-data', label: 'How We Use Your Data' },
	{ id: 'how-we-share-data', label: 'How We Share Your Data' },
	{ id: 'data-storage-security', label: 'Data Storage & Security' },
	{ id: 'data-retention-deletion', label: 'Data Retention & Deletion' },
	{ id: 'cookies-tracking', label: 'Cookies & Tracking' },
	{ id: 'your-rights', label: 'Your Rights' },
	{ id: 'childrens-privacy', label: "Children's Privacy" },
	{ id: 'changes-to-policy', label: 'Changes to This Policy' },
	{ id: 'contact-us', label: 'Contact Us' },
];

export const thirdPartyServices = [
	{
		service: 'Google OAuth',
		purpose: 'Authentication',
		data: 'Email, name, profile photo',
	},
	{
		service: 'Stripe',
		purpose: 'Billing & payments',
		data: 'Email, payment info',
	},
	{
		service: 'Checkr',
		purpose: 'Background checks',
		data: 'PII (name, SSN, DOB)',
	},
	{
		service: 'Sterling',
		purpose: 'Background checks',
		data: 'PII (name, SSN, DOB)',
	},
	{
		service: 'Resend',
		purpose: 'Transactional email',
		data: 'Email address, name',
	},
	{
		service: 'Sentry',
		purpose: 'Error monitoring',
		data: 'Error context (no PII)',
	},
	{
		service: 'Vercel Analytics',
		purpose: 'Usage analytics',
		data: 'Anonymous page views',
	},
	{
		service: 'Upstash Redis',
		purpose: 'Rate limiting',
		data: 'IP hash (no PII stored)',
	},
];

export const versionHistory = [
	{
		date: 'July 29, 2026',
		version: '1.2',
		changes:
			'Disclosed Sterling alongside Checkr as a background check provider — both receive Social Security number and date of birth, and which one receives yours depends on the requesting organization',
	},
	{
		date: 'July 28, 2026',
		version: '1.1',
		changes:
			"Disclosed roster data (organizations may add volunteers directly, before they apply or hold an account) and added the right to revoke an individual organization's access",
	},
	{
		date: 'March 19, 2026',
		version: '1.0',
		changes: 'Initial privacy policy published',
	},
];

export default function PrivacyPage() {
	return (
		<article className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Privacy Policy', href: '/privacy' },
				]}
			/>
			<PublicHero
				eyebrow="Legal"
				heading={
					<>
						Your privacy <em className="italic text-primary">matters to us.</em>
					</>
				}
				description="We handle sensitive data — background checks, personal information, organizational records. Here's exactly what we collect, how we use it, and how we protect it."
			/>

			{/* ── Table of Contents ── */}
			<nav className="mx-auto w-full max-w-3xl px-4 py-16">
				<h2 className="font-display mb-6 text-[32px] font-bold text-foreground [text-wrap:balance]">
					Table of Contents
				</h2>
				<ol className="border-l-2 border-primary/30 pl-6">
					{sections.map((s, i) => (
						<li key={s.id} className="py-1.5">
							<a
								href={`#${s.id}`}
								className="text-sm text-muted-foreground transition-colors hover:text-primary"
							>
								{i + 1}. {s.label}
							</a>
						</li>
					))}
				</ol>
			</nav>

			{/* ── 1. Information We Collect ── */}
			<section id="information-we-collect" className="bg-muted px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Eye className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								1. Information We Collect
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							<strong className="text-foreground">Account information:</strong>{' '}
							When you sign in with Google, we receive your name, email address,
							and profile photo. We use this to create and maintain your
							account.
						</p>
						<p>
							<strong className="text-foreground">
								Volunteer application data:
							</strong>{' '}
							When you apply to volunteer, you provide information such as your
							name, contact details, availability, skills, and qualifications.
							Organizations you apply to can see this data.
						</p>
						<p>
							<strong className="text-foreground">Roster data:</strong> An
							organization may also add you to its volunteer roster directly,
							using your email address — before you have applied to it, and
							before you have created an account. Organizations use this to
							schedule volunteers they already work with offline. Whether an
							organization adds you this way or you apply and it approves you,
							it can then see your volunteer profile, schedule you for shifts,
							and request a background check on you. Organizations holding this
							access are listed on your profile page, and you can revoke any of
							them at any time — see{' '}
							<a href="#your-rights" className="text-primary hover:underline">
								Your Rights
							</a>
							. If an organization added you before you had an account, we
							created one from that address: request a sign-in link at{' '}
							<Link href="/login" className="text-primary hover:underline">
								volunteerready.org/login
							</Link>{' '}
							using the same email the organization used, and the same controls
							apply.
						</p>
						<p>
							<strong className="text-foreground">
								Background check information:
							</strong>{' '}
							If an organization requires a background check, you may provide
							sensitive personal information including your Social Security
							number, date of birth, and address. This data is sent directly to
							the background check provider that organization uses — Checkr or
							Sterling — and is not stored on our servers. Which provider
							receives it depends on the organization requesting the check; ask
							them, or contact us, if you need to know which one holds your
							data.
						</p>
						<p>
							<strong className="text-foreground">
								Organization and billing data:
							</strong>{' '}
							Organizations provide their name, contact details, and payment
							information (processed by Stripe). We store organization profiles
							but do not store credit card numbers.
						</p>
						<p>
							<strong className="text-foreground">Usage data:</strong> We
							collect anonymous usage analytics (pages visited, features used)
							to improve the platform. This data does not identify you
							personally.
						</p>
					</div>
				</div>
			</section>

			{/* ── 2. How We Use Data ── */}
			<section id="how-we-use-data" className="px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Settings className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								2. How We Use Your Data
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>We use the information we collect to:</p>
						<ul className="list-disc space-y-2 pl-6">
							<li>Authenticate your identity and manage your account</li>
							<li>
								Process volunteer applications and match you with opportunities
							</li>
							<li>
								Facilitate background checks on behalf of requesting
								organizations
							</li>
							<li>
								Send transactional emails (application updates, account
								notifications)
							</li>
							<li>
								Process billing and subscription payments for organizations
							</li>
							<li>
								Monitor and fix errors to keep the platform reliable (via
								Sentry)
							</li>
							<li>
								Analyze anonymous usage patterns to improve the product (via
								Vercel Analytics, only with your consent)
							</li>
							<li>Enforce rate limits to prevent abuse</li>
						</ul>
						<p>
							We do not sell your personal data. We do not use your data for
							advertising. We do not build profiles for ad targeting.
						</p>
					</div>
				</div>
			</section>

			{/* ── 3. How We Share Data ── */}
			<section id="how-we-share-data" className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Share2 className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								3. How We Share Your Data
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							<strong className="text-foreground">With organizations.</strong>{' '}
							Organizations receive your volunteer data when you apply to them,
							when they approve your application, or when they add you to their
							roster directly. What they can see includes your name, contact
							details, availability, skills, service history, and credential
							status. Organizations holding this access are listed on your
							profile page, and you can revoke any of them there — see{' '}
							<a href="#your-rights" className="text-primary hover:underline">
								Your Rights
							</a>
							.
						</p>
						<p>
							Otherwise, we share your data only with the third-party services
							necessary to operate the platform. We do not sell or rent your
							data to anyone.
						</p>
						<div className="mt-6 overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border">
										<th className="pb-3 pr-4 font-semibold text-foreground">
											Service
										</th>
										<th className="pb-3 pr-4 font-semibold text-foreground">
											Purpose
										</th>
										<th className="pb-3 font-semibold text-foreground">
											Data Shared
										</th>
									</tr>
								</thead>
								<tbody>
									{thirdPartyServices.map((s) => (
										<tr key={s.service} className="border-b border-border/50">
											<td className="py-3 pr-4 font-medium text-foreground">
												{s.service}
											</td>
											<td className="py-3 pr-4">{s.purpose}</td>
											<td className="py-3">{s.data}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<p className="mt-4">
							We may also share data when required by law, to protect our legal
							rights, or to prevent fraud or security threats.
						</p>
					</div>
				</div>
			</section>

			{/* ── 4. Data Storage & Security ── */}
			<section id="data-storage-security" className="px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Lock className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								4. Data Storage & Security
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							Your data is stored in PostgreSQL databases hosted on secure, SOC
							2-compliant infrastructure. We implement the following safeguards:
						</p>
						<ul className="list-disc space-y-2 pl-6">
							<li>
								<strong className="text-foreground">
									Encryption in transit:
								</strong>{' '}
								All connections use TLS 1.3.
							</li>
							<li>
								<strong className="text-foreground">Encryption at rest:</strong>{' '}
								Database storage is encrypted with AES-256.
							</li>
							<li>
								<strong className="text-foreground">
									Multi-tenant isolation:
								</strong>{' '}
								Every database query is scoped to the requesting organization.
								Organizations cannot access each other's data.
							</li>
							<li>
								<strong className="text-foreground">Access control:</strong>{' '}
								Role-based permissions ensure team members see only what they
								need.
							</li>
							<li>
								<strong className="text-foreground">Audit logging:</strong>{' '}
								Every significant action is logged with timestamps and
								attribution.
							</li>
							<li>
								<strong className="text-foreground">
									No password storage:
								</strong>{' '}
								We use OAuth (Google) for authentication — we never see or store
								your password.
							</li>
						</ul>
						<p>
							Background check data (SSN, DOB) is sent directly to the provider
							the requesting organization uses (see the table above) and is not
							stored on our servers. The credentials we hold to reach a provider
							on an organization's behalf are encrypted at the application layer
							before storage.
						</p>
					</div>
				</div>
			</section>

			{/* ── 5. Data Retention & Deletion ── */}
			<section id="data-retention-deletion" className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Trash2 className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								5. Data Retention & Deletion
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							We retain your personal data for as long as your account is active
							or as needed to provide you services. Specifically:
						</p>
						<ul className="list-disc space-y-2 pl-6">
							<li>
								<strong className="text-foreground">Account data</strong> is
								retained until you request deletion.
							</li>
							<li>
								<strong className="text-foreground">
									Volunteer application records
								</strong>{' '}
								are retained as long as the associated organization account is
								active, or as required by law.
							</li>
							<li>
								<strong className="text-foreground">
									Background check results
								</strong>{' '}
								are retained according to FCRA requirements and the data
								retention policy of the provider that ran the check.
							</li>
							<li>
								<strong className="text-foreground">Billing records</strong> are
								retained as required by tax and financial regulations.
							</li>
						</ul>
						<p>
							<strong className="text-foreground">
								Revoking an organization's access is not the same as deletion.
							</strong>{' '}
							When you remove an organization's access from your profile page,
							that organization can no longer open your volunteer record,
							schedule you, or request a background check. Records of work you
							already did stay with them: your application, any shifts you were
							already booked on, and hours you volunteered remain on their
							account. Shifts you were already booked on stay booked, and the
							organization can still record whether you attended them — cancel
							those signups yourself if you do not intend to go. To have those
							records deleted rather than made inaccessible, use the request
							below or contact the organization directly.
						</p>
						<p>
							<strong className="text-foreground">
								To request deletion of your data,
							</strong>{' '}
							email{' '}
							<a
								href="mailto:privacy@volunteerready.org"
								className="text-primary hover:underline"
							>
								privacy@volunteerready.org
							</a>
							. We will process your request within 30 days. When we delete your
							account, we anonymize your personal information (name, email,
							profile photo) and retain only anonymized records needed for audit
							compliance.
						</p>
					</div>
				</div>
			</section>

			{/* ── 6. Cookies & Tracking ── */}
			<section id="cookies-tracking" className="px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Settings className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								6. Cookies & Tracking
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>We use two categories of cookies:</p>
						<ul className="list-disc space-y-2 pl-6">
							<li>
								<strong className="text-foreground">
									Essential cookies (always active):
								</strong>{' '}
								Required for authentication, session management, and security.
								These cannot be disabled.
							</li>
							<li>
								<strong className="text-foreground">
									Analytics cookies (opt-in):
								</strong>{' '}
								Vercel Analytics collects anonymous page view data to help us
								improve the platform. These are only enabled with your consent
								via our cookie banner.
							</li>
						</ul>
						<p>
							We do not use advertising cookies or tracking pixels. You can
							change your cookie preferences at any time using the cookie
							settings in the banner at the bottom of the page.
						</p>
					</div>
				</div>
			</section>

			{/* ── 7. Your Rights ── */}
			<section id="your-rights" className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<UserCheck className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								7. Your Rights
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							Depending on your location, you may have the following rights
							regarding your personal data:
						</p>
						<ul className="list-disc space-y-2 pl-6">
							<li>
								<strong className="text-foreground">Access:</strong> Request a
								copy of the personal data we hold about you.
							</li>
							<li>
								<strong className="text-foreground">Correction:</strong> Request
								that we correct inaccurate or incomplete data.
							</li>
							<li>
								<strong className="text-foreground">Deletion:</strong> Request
								that we delete your personal data.
							</li>
							<li>
								<strong className="text-foreground">Portability:</strong>{' '}
								Request a machine-readable export of your data.
							</li>
							<li>
								<strong className="text-foreground">Withdraw consent:</strong>{' '}
								Opt out of analytics cookies at any time.
							</li>
							<li>
								<strong className="text-foreground">
									Revoke an organization's access:
								</strong>{' '}
								Remove a specific organization's ability to open your volunteer
								record, schedule you, or request a background check. You do this
								yourself from your profile page and it takes effect immediately
								— you do not need to contact us, and the organization cannot add
								you back. You can rejoin at any time by signing in and applying
								to them, or by signing up for one of their shifts. Two limits
								worth knowing: this does not un-publish a profile you have set
								to Public, which stays visible to everyone — including
								organizations you have left — until you change your profile
								visibility; and if you are also on that organization's staff,
								leaving its volunteer roster does not change your staff access.
							</li>
						</ul>
						<p>
							To exercise any of these rights, contact us at{' '}
							<a
								href="mailto:privacy@volunteerready.org"
								className="text-primary hover:underline"
							>
								privacy@volunteerready.org
							</a>
							. We will respond within 30 days.
						</p>
					</div>
				</div>
			</section>

			{/* ── 8. Children's Privacy ── */}
			<section id="childrens-privacy" className="px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<ShieldAlert className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								8. Children's Privacy
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							VolunteerReady is not intended for use by individuals under the
							age of 16. We do not knowingly collect personal information from
							children. If we become aware that we have collected data from a
							child under 16, we will delete it promptly. If you believe a child
							has provided us with personal information, please contact us at{' '}
							<a
								href="mailto:privacy@volunteerready.org"
								className="text-primary hover:underline"
							>
								privacy@volunteerready.org
							</a>
							.
						</p>
					</div>
				</div>
			</section>

			{/* ── 9. Changes to Policy ── */}
			<section id="changes-to-policy" className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<FileText className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								9. Changes to This Policy
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							We may update this privacy policy from time to time. When we make
							significant changes, we will notify you by email or by posting a
							notice on our platform. The "Last updated" date at the top of this
							page reflects the most recent revision.
						</p>
						<h3 className="mt-8 text-lg font-semibold text-foreground">
							Version History
						</h3>
						<div className="mt-4 overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border">
										<th className="pb-3 pr-4 font-semibold text-foreground">
											Date
										</th>
										<th className="pb-3 pr-4 font-semibold text-foreground">
											Version
										</th>
										<th className="pb-3 font-semibold text-foreground">
											Changes
										</th>
									</tr>
								</thead>
								<tbody>
									{versionHistory.map((v) => (
										<tr key={v.version} className="border-b border-border/50">
											<td className="py-3 pr-4 text-foreground">{v.date}</td>
											<td className="py-3 pr-4">{v.version}</td>
											<td className="py-3">{v.changes}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</section>

			{/* ── 10. Contact Us ── */}
			<section id="contact-us" className="px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<div className="flex gap-5">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Mail className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
								10. Contact Us
							</h2>
						</div>
					</div>
					<div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							If you have questions about this privacy policy or our data
							practices, contact us at:
						</p>
						<div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
							<p className="font-semibold text-foreground">
								VolunteerReady Privacy Team
							</p>
							<p className="mt-1">
								Email:{' '}
								<a
									href="mailto:privacy@volunteerready.org"
									className="text-primary hover:underline"
								>
									privacy@volunteerready.org
								</a>
							</p>
							<p className="mt-1">
								Website:{' '}
								<Link href="/" className="text-primary hover:underline">
									www.volunteerready.org
								</Link>
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* ── Effective date ── */}
			<div className="border-t border-border/40 px-4 py-8">
				<p className="mx-auto max-w-3xl text-xs text-muted-foreground">
					This privacy policy is effective as of July 29, 2026 (Version 1.2).
				</p>
			</div>
		</article>
	);
}
