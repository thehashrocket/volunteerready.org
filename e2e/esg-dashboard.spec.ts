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
let companyBId: string;
let sessionToken: string;
let multiCompanySessionToken: string;
let outsiderSessionToken: string;
let userId: string;
let outsiderUserId: string;
let orgId: string;

// Only rows older than this are swept by cleanupByPrefix. Locally a full
// worker lifecycle (beforeAll -> test -> afterAll) takes ~1-2s, but this
// needs to hold under CI conditions too: a cold `pnpm dev` webServer
// Turbopack compile, or resource-starved parallel workers, can push a
// sibling worker's run well past a tight margin. The only cost of a wider
// window is slower cleanup of genuinely crashed leftovers, so it's set
// generously rather than tuned to the fast case.
const STALE_LEFTOVER_MS = 30 * 60 * 1000;

// Sweeps rows matching the shared literal PREFIX that are older than
// STALE_LEFTOVER_MS — safe to call in beforeAll, but NOT unbounded, and NOT
// in afterAll: Playwright's fullyParallel mode runs this file's two tests in
// separate worker processes, each with its own beforeAll/afterAll. An
// unbounded prefix sweep here could delete a still-running sibling worker's
// freshly created (and still in-use) session/company rows out from under it
// — exactly the P0 "wrong page rendered" flake (root-caused via
// /investigate, 2026-07-15): the fast "non-member" worker's afterAll wiped
// the slower "loads real aggregates" worker's session mid-test, so that
// worker's requests resolved to an unauthenticated/company-less context.
// The age cutoff closes the same race for beforeAll: even if a worker's
// beforeAll starts late (uneven browser-launch latency) and runs this sweep
// after a sibling has already created its rows, those rows are seconds old
// and won't match — only genuinely abandoned rows from a crashed prior run do.
async function cleanupByPrefix() {
	const prisma = getPrisma();
	const olderThan = new Date(Date.now() - STALE_LEFTOVER_MS);
	const users = await prisma.user.findMany({
		where: { email: { startsWith: PREFIX }, createdAt: { lt: olderThan } },
		select: { id: true },
	});
	const userIds = users.map((u) => u.id);
	const companies = await prisma.companyAccount.findMany({
		where: { slug: { startsWith: PREFIX }, createdAt: { lt: olderThan } },
		select: { id: true },
	});
	const companyIds = companies.map((c) => c.id);
	const orgs = await prisma.organization.findMany({
		where: { slug: { startsWith: PREFIX }, createdAt: { lt: olderThan } },
		select: { id: true },
	});
	const orgIds = orgs.map((o) => o.id);

	await cleanupIds({ userIds, companyIds, orgIds });
}

// Deletes exactly the rows this run created — safe to call concurrently
// with a sibling worker's own cleanup, since it never touches rows it
// didn't create itself.
async function cleanupIds({
	userIds,
	companyIds,
	orgIds,
}: {
	userIds: string[];
	companyIds: string[];
	orgIds: string[];
}) {
	const prisma = getPrisma();

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
	await cleanupByPrefix(); // clear leftovers from a previous crashed run

	const run = randomUUID().slice(0, 8);

	const user = await prisma.user.create({
		data: {
			name: `${PREFIX}admin-${run}`,
			email: `${PREFIX}${run}@e2e.local`,
		},
	});
	userId = user.id;

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
	orgId = org.id;

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

	// A second company the same user also belongs to, plus a session pinned
	// to IT instead — used to prove the ESG page is authorized/rendered from
	// the URL's companyId, not whichever company the session has active.
	const companyB = await prisma.companyAccount.create({
		data: {
			name: `${PREFIX}company-b-${run}`,
			slug: `${PREFIX}company-b-${run}`,
			planTier: 'PRO',
		},
	});
	companyBId = companyB.id;
	await prisma.companyMember.create({
		data: { companyId: companyB.id, userId: user.id, role: 'OWNER' },
	});
	multiCompanySessionToken = await createSession({
		userId: user.id,
		currentCompanyId: companyB.id,
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
	outsiderUserId = outsider.id;
	outsiderSessionToken = await createSession({
		userId: outsider.id,
		ttlMs: 24 * 60 * 60 * 1000,
	});
});

test.afterAll(async () => {
	// beforeAll may have thrown partway through (Playwright still runs
	// afterAll in that case) — filter out whatever wasn't assigned rather
	// than passing undefined into a Prisma `id: { in: [...] }` filter. Any
	// rows created before the throw are still swept eventually by the next
	// run's cleanupByPrefix() once they age past STALE_LEFTOVER_MS.
	await cleanupIds({
		userIds: [userId, outsiderUserId].filter(Boolean),
		companyIds: [companyId, companyBId].filter(Boolean),
		orgIds: [orgId].filter(Boolean),
	});
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

	test('URL companyId is authoritative — a member of two companies visiting company A sees company A, not the session-active company B', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		// Session's active company is B; the URL names company A.
		await context.addCookies([
			{
				name: SESSION_COOKIE_NAME,
				value: multiCompanySessionToken,
				url: baseURL,
			},
		]);

		await page.goto(`/app/company/${companyId}/esg`);

		await expect(
			page.getByRole('heading', { name: 'ESG Volunteer Impact' }),
		).toBeVisible();

		// Company A's seeded activity must render (company B has zero activity —
		// if the bug were present, this would render B's zero-state instead).
		await expect(
			page.getByText(/no volunteer activity recorded yet/i),
		).not.toBeVisible();
		const orgRow = page
			.getByRole('row')
			.filter({ hasText: `${PREFIX}org-` })
			.first();
		await expect(orgRow).toBeVisible();
		await expect(orgRow.getByText('3', { exact: true })).toBeVisible();
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
