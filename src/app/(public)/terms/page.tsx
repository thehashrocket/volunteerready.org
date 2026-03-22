import type { Metadata } from 'next';
import Link from 'next/link';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';

export const metadata: Metadata = {
	title: 'Terms of Service — VolunteerReady',
	description: 'Terms and conditions for using the VolunteerReady platform.',
	openGraph: {
		title: 'Terms of Service — VolunteerReady',
		description: 'Terms and conditions for using the VolunteerReady platform.',
		images: [{ url: '/api/og/page/terms', width: 1200, height: 630 }],
	},
};

const sections = [
	{ id: 'acceptance', label: 'Acceptance of Terms' },
	{ id: 'description', label: 'Description of Service' },
	{ id: 'accounts', label: 'Accounts & Registration' },
	{ id: 'organizations', label: 'Organization Responsibilities' },
	{ id: 'volunteers', label: 'Volunteer Responsibilities' },
	{ id: 'background-checks', label: 'Background Checks' },
	{ id: 'billing', label: 'Billing & Payments' },
	{ id: 'intellectual-property', label: 'Intellectual Property' },
	{ id: 'acceptable-use', label: 'Acceptable Use' },
	{ id: 'termination', label: 'Termination' },
	{ id: 'disclaimers', label: 'Disclaimers' },
	{ id: 'limitation-of-liability', label: 'Limitation of Liability' },
	{ id: 'governing-law', label: 'Governing Law' },
	{ id: 'changes', label: 'Changes to Terms' },
	{ id: 'contact', label: 'Contact' },
];

export default function TermsPage() {
	return (
		<article className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Terms of Service', href: '/terms' },
				]}
			/>
			<PublicHero
				eyebrow="Legal"
				heading={
					<>
						Terms of <em className="italic text-primary">Service.</em>
					</>
				}
				description="The rules of the road for using VolunteerReady. Plain language wherever possible."
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

			{/* ── 1. Acceptance ── */}
			<Section id="acceptance" bg="muted" heading="1. Acceptance of Terms">
				<p>
					By accessing or using VolunteerReady ("the Service"), you agree to be
					bound by these Terms of Service ("Terms"). If you do not agree, do not
					use the Service. These Terms apply to all users, including volunteers,
					organizations, and corporate partners.
				</p>
			</Section>

			{/* ── 2. Description ── */}
			<Section id="description" heading="2. Description of Service">
				<p>
					VolunteerReady is a multi-tenant platform that helps nonprofits
					recruit, screen, schedule, and manage volunteers. The Service
					includes:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Volunteer opportunity posting and discovery</li>
					<li>Volunteer application management</li>
					<li>Background check facilitation (via Checkr)</li>
					<li>Volunteer credential management</li>
					<li>Organization administration tools</li>
					<li>Billing and subscription management (via Stripe)</li>
				</ul>
			</Section>

			{/* ── 3. Accounts ── */}
			<Section id="accounts" bg="muted" heading="3. Accounts & Registration">
				<p>
					You must sign in using Google OAuth to create an account. You are
					responsible for maintaining the security of your Google account. You
					agree to provide accurate information and to keep your account
					information current.
				</p>
				<p>
					You may not create accounts for the purpose of impersonating another
					person, creating fake volunteer profiles, or circumventing
					organization policies.
				</p>
			</Section>

			{/* ── 4. Organizations ── */}
			<Section id="organizations" heading="4. Organization Responsibilities">
				<p>
					Organizations that use VolunteerReady to manage volunteers are
					responsible for:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Ensuring their use of volunteer data complies with applicable laws,
						including FCRA requirements for background checks
					</li>
					<li>
						Obtaining appropriate consent from volunteers before initiating
						background checks
					</li>
					<li>
						Following the adverse action process required by the FCRA when
						taking action based on background check results
					</li>
					<li>
						Maintaining accurate organization information and authorized team
						members
					</li>
					<li>
						Not using the platform to discriminate against volunteers on the
						basis of protected characteristics
					</li>
				</ul>
			</Section>

			{/* ── 5. Volunteers ── */}
			<Section
				id="volunteers"
				bg="muted"
				heading="5. Volunteer Responsibilities"
			>
				<p>Volunteers who use VolunteerReady agree to:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Provide accurate information in applications and profiles</li>
					<li>
						Understand that organizations may require background checks as a
						condition of volunteering
					</li>
					<li>Not misrepresent qualifications, credentials, or availability</li>
					<li>
						Communicate respectfully with organizations and fellow volunteers
					</li>
				</ul>
			</Section>

			{/* ── 6. Background Checks ── */}
			<Section id="background-checks" heading="6. Background Checks">
				<p>
					VolunteerReady facilitates background checks through Checkr, a
					third-party consumer reporting agency. By consenting to a background
					check:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						You authorize Checkr to conduct the check and share the results with
						the requesting organization
					</li>
					<li>
						You understand that sensitive personal information (SSN, DOB) is
						sent directly to Checkr and is not stored on VolunteerReady's
						servers
					</li>
					<li>
						You have the right to dispute the accuracy of background check
						results directly with Checkr
					</li>
				</ul>
				<p>
					VolunteerReady is not a consumer reporting agency and does not make
					employment or volunteer eligibility decisions. Those decisions are
					made solely by the requesting organization.
				</p>
			</Section>

			{/* ── 7. Billing ── */}
			<Section id="billing" bg="muted" heading="7. Billing & Payments">
				<p>
					Organizations on paid plans are billed through Stripe. Subscription
					fees are billed in advance on a monthly or annual basis. You may
					cancel your subscription at any time; cancellation takes effect at the
					end of the current billing period. We do not offer refunds for partial
					billing periods.
				</p>
				<p>
					We reserve the right to change pricing with 30 days' notice. Continued
					use after a price change constitutes acceptance of the new pricing.
				</p>
			</Section>

			{/* ── 8. IP ── */}
			<Section id="intellectual-property" heading="8. Intellectual Property">
				<p>
					The Service, including its design, code, features, and content, is
					owned by VolunteerReady and protected by intellectual property laws.
					You may not copy, modify, distribute, or reverse-engineer any part of
					the Service.
				</p>
				<p>
					You retain ownership of all data you submit to the platform. By
					submitting data, you grant us a limited license to use it solely to
					provide the Service to you.
				</p>
			</Section>

			{/* ── 9. Acceptable Use ── */}
			<Section id="acceptable-use" bg="muted" heading="9. Acceptable Use">
				<p>You may not use VolunteerReady to:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Violate any applicable law or regulation</li>
					<li>
						Upload malicious software, spam, or content that infringes on
						others' rights
					</li>
					<li>
						Attempt to gain unauthorized access to other accounts or
						organizations
					</li>
					<li>
						Scrape, crawl, or automated-access the platform without consent
					</li>
					<li>Interfere with the operation of the Service</li>
					<li>
						Use the platform for any purpose unrelated to volunteer management
					</li>
				</ul>
			</Section>

			{/* ── 10. Termination ── */}
			<Section id="termination" heading="10. Termination">
				<p>
					You may delete your account at any time. We may suspend or terminate
					your access if you violate these Terms or engage in conduct that we
					reasonably believe is harmful to other users or the platform.
				</p>
				<p>
					Upon termination, your right to use the Service ceases immediately.
					Data retention and deletion follow our{' '}
					<Link
						href="/privacy#data-retention-deletion"
						className="text-primary hover:underline"
					>
						Privacy Policy
					</Link>
					.
				</p>
			</Section>

			{/* ── 11. Disclaimers ── */}
			<Section id="disclaimers" bg="muted" heading="11. Disclaimers">
				<p>
					THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
					OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE
					WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
				</p>
				<p>
					VolunteerReady does not guarantee the accuracy of background check
					results, the suitability of any volunteer, or the legitimacy of any
					organization on the platform. Users are responsible for their own due
					diligence.
				</p>
			</Section>

			{/* ── 12. Liability ── */}
			<Section
				id="limitation-of-liability"
				heading="12. Limitation of Liability"
			>
				<p>
					TO THE MAXIMUM EXTENT PERMITTED BY LAW, VOLUNTEERREADY SHALL NOT BE
					LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
					PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
				</p>
				<p>
					Our total liability for any claim arising from these Terms or the
					Service shall not exceed the amount you paid us in the 12 months
					preceding the claim, or $100, whichever is greater.
				</p>
			</Section>

			{/* ── 13. Governing Law ── */}
			<Section id="governing-law" bg="muted" heading="13. Governing Law">
				<p>
					These Terms are governed by the laws of the State of Delaware, without
					regard to conflict of law principles. Any disputes will be resolved in
					the state or federal courts located in Delaware.
				</p>
			</Section>

			{/* ── 14. Changes ── */}
			<Section id="changes" heading="14. Changes to Terms">
				<p>
					We may update these Terms from time to time. When we make material
					changes, we will notify you by email or by posting a notice on the
					platform at least 30 days before the changes take effect. Your
					continued use of the Service after changes take effect constitutes
					acceptance of the updated Terms.
				</p>
			</Section>

			{/* ── 15. Contact ── */}
			<section id="contact" className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<FadeInOnScroll>
						<h2 className="font-display mb-6 text-[32px] font-bold text-foreground [text-wrap:balance]">
							15. Contact
						</h2>
					</FadeInOnScroll>
					<div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
						<p>If you have questions about these Terms, contact us at:</p>
						<div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
							<p className="font-semibold text-foreground">
								VolunteerReady Legal Team
							</p>
							<p className="mt-1">
								Email:{' '}
								<a
									href="mailto:legal@volunteerready.org"
									className="text-primary hover:underline"
								>
									legal@volunteerready.org
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
					These Terms of Service are effective as of March 19, 2026.
				</p>
			</div>
		</article>
	);
}

function Section({
	id,
	bg,
	heading,
	children,
}: {
	id: string;
	bg?: 'muted';
	heading: string;
	children: React.ReactNode;
}) {
	const bgClass = bg === 'muted' ? 'bg-[#F5F4F0]' : '';
	const pyClass = bg === 'muted' ? 'py-16' : 'py-20';
	return (
		<section id={id} className={`${bgClass} px-4 ${pyClass}`}>
			<div className="mx-auto max-w-3xl">
				<FadeInOnScroll>
					<h2 className="font-display mb-6 text-[32px] font-bold text-foreground [text-wrap:balance]">
						{heading}
					</h2>
				</FadeInOnScroll>
				<div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
					{children}
				</div>
			</div>
		</section>
	);
}
