// ---------------------------------------------------------------------------
// Authenticated ESG dashboard smoke (issue #126).
//
// This spec runs against the real dev server (`pnpm dev` via webServer) — the
// ONLY environment that reproduces the Turbopack Sql-fragment bug class that
// 500'd esgReport.getSummary. Unit and integration tests run under
// vitest/tsx (single module graph) and can never catch it.
//
// Auth harness: seeds a user + database Session row directly, then sets the
// `next-auth.session-token` cookie (database session strategy). Seeded data
// uses a unique prefix and is cleaned up in afterAll.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
	createSession,
	disconnectPrisma,
	getPrisma,
	SESSION_COOKIE_NAME,
} from './utils/db';

const PREFIX = '__esg_e2e__';

// This spec seeds sessions/data into the .env.local database — a remote
// PLAYWRIGHT_BASE_URL target would not share it (and https targets use the
// __Secure- cookie name), so it only supports localhost targets.
const REMOTE_TARGET =
	!!process.env.PLAYWRIGHT_BASE_URL &&
	!/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL);
test.skip(
	REMOTE_TARGET,
	'esg-dashboard.spec.ts seeds the local database — remote targets unsupported',
);

let companyId: string;
let sessionToken: string;
let outsiderSessionToken: string;

async function cleanup() {
	const prisma = getPrisma();
	const users = await prisma.user.findMany({
		where: { email: { startsWith: PREFIX } },
		select: { id: true },
	});
	const userIds = users.map((u) => u.id);
	const companies = await prisma.companyAccount.findMany({
		where: { slug: { startsWith: PREFIX } },
		select: { id: true },
	});
	const companyIds = companies.map((c) => c.id);
	const orgs = await prisma.organization.findMany({
		where: { slug: { startsWith: PREFIX } },
		select: { id: true },
	});
	const orgIds = orgs.map((o) => o.id);

	if (userIds.length > 0) {
		await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
		await prisma.shiftSignup.deleteMany({ where: { userId: { in: userIds } } });
	}
	if (orgIds.length > 0) {
		await prisma.shift.deleteMany({ where: { orgId: { in: orgIds } } });
	}
	if (companyIds.length > 0) {
		await prisma.companyMember.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.companyNonprofitLink.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.auditLog.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.companyAccount.deleteMany({
			where: { id: { in: companyIds } },
		});
	}
	if (orgIds.length > 0) {
		await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
	}
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
}

test.beforeAll(async () => {
	const prisma = getPrisma();
	await cleanup(); // clear leftovers from a previous crashed run

	const run = randomUUID().slice(0, 8);

	const user = await prisma.user.create({
		data: {
			name: `${PREFIX}admin-${run}`,
			email: `${PREFIX}${run}@e2e.local`,
		},
	});

	const company = await prisma.companyAccount.create({
		data: {
			name: `${PREFIX}company-${run}`,
			slug: `${PREFIX}company-${run}`,
			planTier: 'PRO',
		},
	});
	companyId = company.id;

	await prisma.companyMember.create({
		data: { companyId: company.id, userId: user.id, role: 'OWNER' },
	});

	const org = await prisma.organization.create({
		data: {
			name: `${PREFIX}org-${run}`,
			slug: `${PREFIX}org-${run}`,
		},
	});

	await prisma.companyNonprofitLink.create({
		data: { companyId: company.id, orgId: org.id, status: 'ACTIVE' },
	});

	// One attended 3-hour shift in the past
	const shift = await prisma.shift.create({
		data: {
			orgId: org.id,
			title: `${PREFIX}shift-${run}`,
			startTime: new Date('2026-06-01T09:00:00Z'),
			endTime: new Date('2026-06-01T12:00:00Z'),
			capacity: 10,
		},
	});
	await prisma.shiftSignup.create({
		data: { shiftId: shift.id, userId: user.id, status: 'ATTENDED' },
	});

	// Database session (NextAuth strategy: 'database') pinned to the company
	sessionToken = await createSession({
		userId: user.id,
		currentCompanyId: company.id,
		ttlMs: 24 * 60 * 60 * 1000,
	});

	// Outsider: authenticated but NOT a member of the company — used to prove
	// the company layout's membership guard still holds after the /app/company
	// no-org-redirect exemption.
	const outsider = await prisma.user.create({
		data: {
			name: `${PREFIX}outsider-${run}`,
			email: `${PREFIX}outsider-${run}@e2e.local`,
		},
	});
	outsiderSessionToken = await createSession({
		userId: outsider.id,
		ttlMs: 24 * 60 * 60 * 1000,
	});
});

test.afterAll(async () => {
	await cleanup();
	await disconnectPrisma();
});

test.describe('ESG dashboard (authenticated, dev server)', () => {
	test('loads real aggregates — no 500, no error card, no fabricated zeros', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: sessionToken, url: baseURL },
		]);

		// Fail fast on a 500 from the tRPC query
		const failedResponses: string[] = [];
		page.on('response', (res) => {
			if (res.status() >= 500) {
				failedResponses.push(`${res.status()} ${res.url()}`);
			}
		});

		await page.goto(`/app/company/${companyId}/esg`);

		await expect(
			page.getByRole('heading', { name: 'ESG Volunteer Impact' }),
		).toBeVisible();

		// The report loaded: 1 attended 3h shift at 1 org
		await expect(page.getByText('Shifts Completed')).toBeVisible();
		await expect(page.getByText('Total Hours')).toBeVisible();

		// Bug 1 regression: no error card
		await expect(
			page.getByText(/couldn’t load your esg report/i),
		).not.toBeVisible();

		// Bug 2 regression: seeded activity must never render as the zero-state
		await expect(
			page.getByText(/no volunteer activity recorded yet/i),
		).not.toBeVisible();

		// Seeded org row shows the aggregate values: 1 employee, 1 shift, 3 hours
		const orgRow = page
			.getByRole('row')
			.filter({ hasText: `${PREFIX}org-` })
			.first();
		await expect(orgRow).toBeVisible();
		await expect(orgRow.getByText('3', { exact: true })).toBeVisible();

		expect(failedResponses, `5xx responses: ${failedResponses.join(', ')}`).toHaveLength(
			0,
		);
	});

	test('non-member is redirected away — membership guard intact after the no-org exemption', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: outsiderSessionToken, url: baseURL },
		]);

		await page.goto(`/app/company/${companyId}/esg`);

		// The company layout's getCompanyMembership guard must bounce them out
		await expect(page).not.toHaveURL(new RegExp(`/app/company/${companyId}`));
		await expect(
			page.getByRole('heading', { name: 'ESG Volunteer Impact' }),
		).not.toBeVisible();
	});
});
