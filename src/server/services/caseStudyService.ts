/**
 * Case Study Service — composes existing data sources into CaseStudyData.
 *
 * Data sources:
 *   - Organization (name, slug, createdAt, baseline, consent)
 *   - getImpactReport → lifetime summary
 *   - orgAnalyticsRepo → retention, fill rate, top volunteers
 *   - OrgFeedback → pull quote from DAY_30 (fallback: DAY_7)
 */

import type {
	CaseStudyBaseline,
	CaseStudyData,
} from '@/server/domain/case-study';
import { createConsentToken } from '@/server/lib/case-study-token';
import { sendEmail } from '@/server/lib/email';
import {
	getAvgFillRate,
	getRetentionStats,
	getTopVolunteers,
} from '@/server/repositories/orgAnalyticsRepo';
import { prisma } from '@/server/repositories/prisma';
import { getImpactReport } from '@/server/services/screener-queries';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Core: build CaseStudyData for a single org
// ---------------------------------------------------------------------------

export async function getCaseStudy(
	orgId: string,
): Promise<CaseStudyData | null> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: {
			id: true,
			name: true,
			slug: true,
			createdAt: true,
			onboardingBaseline: true,
			consentToPublicize: true,
			logoUrl: true,
		},
	});
	if (!org) return null;

	const fromDate = org.createdAt;
	const now = new Date();
	const daysOnPlatform = Math.floor(
		(now.getTime() - org.createdAt.getTime()) / (1000 * 60 * 60 * 24),
	);

	// Retention: use createdAt + 90 days as the "current period" start
	// If org is < 90 days old, skip retention
	const retentionFromDate = new Date(org.createdAt.getTime() + NINETY_DAYS_MS);
	const orgOldEnough = now.getTime() > retentionFromDate.getTime();

	const [impactReport, retention, avgFillRate, topVolunteers, feedback] =
		await Promise.all([
			getImpactReport(orgId),
			orgOldEnough
				? getRetentionStats(orgId, retentionFromDate)
				: Promise.resolve(null),
			getAvgFillRate(orgId, fromDate),
			getTopVolunteers(orgId, 5, fromDate),
			getPullQuote(orgId),
		]);

	const baseline = parseBaseline(org.onboardingBaseline);

	return {
		orgId: org.id,
		orgSlug: org.slug,
		orgName: org.name,
		logoUrl: org.logoUrl,
		createdAt: org.createdAt,
		daysOnPlatform,
		baseline,
		summary: impactReport?.summary ?? {
			totalVolunteers: 0,
			backgroundChecksCompleted: 0,
			shiftsCreated: 0,
			credentialsIssued: 0,
			applicationsSubmitted: 0,
			applicationsApproved: 0,
		},
		retention,
		avgFillRate,
		topVolunteers,
		pullQuote: feedback,
		consentToPublicize: org.consentToPublicize,
	};
}

// ---------------------------------------------------------------------------
// List all consented orgs with case study data
// ---------------------------------------------------------------------------

export async function getConsentedCaseStudies(): Promise<CaseStudyData[]> {
	const orgs = await prisma.organization.findMany({
		where: { consentToPublicize: true },
		select: { id: true },
		orderBy: { updatedAt: 'desc' },
	});

	const results = await Promise.all(orgs.map((o) => getCaseStudy(o.id)));
	return results.filter((r): r is CaseStudyData => r !== null);
}

// ---------------------------------------------------------------------------
// List ALL orgs with case study data (admin view)
// ---------------------------------------------------------------------------

export async function getAllOrgsForCaseStudies(): Promise<CaseStudyData[]> {
	const orgs = await prisma.organization.findMany({
		select: { id: true },
		orderBy: { createdAt: 'desc' },
	});

	const results = await Promise.all(orgs.map((o) => getCaseStudy(o.id)));
	return results.filter((r): r is CaseStudyData => r !== null);
}

// ---------------------------------------------------------------------------
// Testimonials for landing page (lightweight)
// ---------------------------------------------------------------------------

export type Testimonial = {
	orgName: string;
	orgSlug: string;
	pullQuote: string;
	hoursPerWeek: number | null;
};

export async function getTestimonials(): Promise<Testimonial[]> {
	const orgs = await prisma.organization.findMany({
		where: { consentToPublicize: true },
		select: {
			id: true,
			name: true,
			slug: true,
			onboardingBaseline: true,
		},
	});

	const testimonials: Testimonial[] = [];
	for (const org of orgs) {
		const quote = await getPullQuote(org.id);
		if (!quote) continue;

		const baseline = parseBaseline(org.onboardingBaseline);
		testimonials.push({
			orgName: org.name,
			orgSlug: org.slug,
			pullQuote: quote,
			hoursPerWeek: baseline?.hoursPerWeek ?? null,
		});
	}

	return testimonials;
}

// ---------------------------------------------------------------------------
// Send approval email
// ---------------------------------------------------------------------------

export async function sendApprovalEmail(
	orgId: string,
): Promise<{ sent: boolean; to: string | null }> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: {
			id: true,
			name: true,
			members: {
				where: { role: { in: ['ADMIN', 'OWNER'] } },
				select: { user: { select: { email: true } } },
				take: 1,
				orderBy: { createdAt: 'asc' },
			},
		},
	});
	if (!org) return { sent: false, to: null };

	const adminEmail = org.members[0]?.user?.email;
	if (!adminEmail) return { sent: false, to: null };

	// Get case study data for email preview
	const caseStudy = await getCaseStudy(orgId);
	if (!caseStudy) return { sent: false, to: null };

	const token = createConsentToken(orgId);
	const baseUrl = process.env.NEXTAUTH_URL ?? 'https://volunteerready.org';
	const approveUrl = `${baseUrl}/api/case-study/consent?token=${encodeURIComponent(token)}`;

	// Escape user-controlled values to prevent HTML injection in emails
	const safeName = escapeHtml(org.name);
	const safeQuote = caseStudy.pullQuote
		? escapeHtml(caseStudy.pullQuote)
		: null;

	// Email content: pull quote + 2 top metrics
	const quoteHtml = safeQuote
		? `<blockquote style="border-left: 4px solid #C4A882; padding-left: 16px; margin: 16px 0; font-style: italic; color: #3D3B38;">"${safeQuote}"</blockquote>`
		: '';

	const metrics = [
		`<strong>${caseStudy.summary.applicationsSubmitted}</strong> applications processed`,
	];
	if (caseStudy.baseline?.hoursPerWeek) {
		const saved = Math.max(
			0,
			Math.round(caseStudy.baseline.hoursPerWeek * 0.6),
		);
		metrics.push(`Saved <strong>${saved} hrs/week</strong> on admin`);
	} else {
		metrics.push(
			`<strong>${caseStudy.summary.credentialsIssued}</strong> credentials issued`,
		);
	}

	const htmlContent = `
		<h2 style="font-family: Georgia, serif; color: #1B3C2A; margin-bottom: 16px;">
			Your impact with VolunteerReady
		</h2>
		<p>Hi ${safeName} team,</p>
		<p>Here's a preview of how your numbers and feedback could appear on our site:</p>
		${quoteHtml}
		<ul style="list-style: none; padding: 0;">
			${metrics.map((m) => `<li style="margin: 8px 0;">✓ ${m}</li>`).join('')}
		</ul>
		<p>Would you like to share your story? One click and you're done:</p>
		<p style="text-align: center; margin: 24px 0;">
			<a href="${approveUrl}" style="display: inline-block; background-color: #1B3C2A; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
				Approve
			</a>
		</p>
		<p style="color: #787571; font-size: 14px;">This link expires in 7 days. Your data stays private unless you approve.</p>
	`;

	const sent = await sendEmail(
		adminEmail,
		`${org.name} — your VolunteerReady impact story`,
		htmlContent,
	);

	return { sent, to: adminEmail };
}

// ---------------------------------------------------------------------------
// Set consent
// ---------------------------------------------------------------------------

export async function setOrgConsent(
	orgId: string,
	consent: boolean,
): Promise<void> {
	await prisma.organization.update({
		where: { id: orgId },
		data: { consentToPublicize: consent },
	});
}

// ---------------------------------------------------------------------------
// PDF generation (dynamic import to keep @react-pdf out of main bundle)
// ---------------------------------------------------------------------------

export async function generateCaseStudyPdf(
	orgId: string,
): Promise<Buffer | null> {
	const data = await getCaseStudy(orgId);
	if (!data) return null;

	const { formatCaseStudyPdf } = await import('@/server/domain/case-study-pdf');
	return formatCaseStudyPdf(data);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBaseline(raw: unknown): CaseStudyBaseline | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	return {
		volunteerCount:
			typeof obj.volunteerCount === 'number' ? obj.volunteerCount : undefined,
		hoursPerWeek:
			typeof obj.hoursPerWeek === 'number' ? obj.hoursPerWeek : undefined,
		currentProcess:
			typeof obj.currentProcess === 'string' ? obj.currentProcess : undefined,
	};
}

async function getPullQuote(orgId: string): Promise<string | null> {
	// Prefer DAY_30 feedback, fall back to DAY_7
	const { Prisma } = await import('@/prisma/generated/client');
	const feedbacks = await prisma.orgFeedback.findMany({
		where: { orgId, responses: { not: Prisma.DbNull } },
		orderBy: { type: 'desc' }, // DAY_30 sorts after DAY_7
	});

	for (const fb of feedbacks) {
		const responses = fb.responses as Record<string, string> | null;
		if (responses?.working_well) {
			return responses.working_well;
		}
	}

	return null;
}
