// ---------------------------------------------------------------------------
// Impersonation multi-company picker (docs/TODOS.md:1519, split via
// /plan-eng-review 2026-07-20).
//
// A platform admin impersonating a target who belongs to 2+ companies used
// to be silently routed to the target's *oldest* company membership, with
// no way to reach the others — both from the sidebar's "Company" link
// (app/(app)/app/layout.tsx) and from /app/company itself. This spec proves
// the fix end to end against the real dev server: the sidebar link falls
// back to the bare /app/company picker, which lists every company the
// target belongs to and links to each one.
//
// Kept in its own file rather than appended to esg-dashboard.spec.ts —
// no impersonation e2e harness exists yet, and esg-dashboard.spec.ts already
// carries its own custom cross-worker cleanup/parallelism constraints that
// this scenario doesn't need (see CLAUDE.md's e2e cleanup guidance).
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { IMPERSONATION_COOKIE } from '../src/server/domain/impersonation';
import { createSession, disconnectPrisma, getPrisma, SESSION_COOKIE_NAME } from './utils/db';

const PREFIX = '__impersonation_e2e__';

const REMOTE_TARGET =
	!!process.env.PLAYWRIGHT_BASE_URL &&
	!/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL);
test.skip(
	REMOTE_TARGET,
	'impersonation-company-picker.spec.ts seeds the local database — remote targets unsupported',
);

let adminUserId: string;
let targetUserId: string;
let companyAId: string;
let companyBId: string;
let impersonationSessionId: string;
let adminSessionToken: string;

test.beforeAll(async () => {
	const prisma = getPrisma();
	const run = randomUUID().slice(0, 8);

	const admin = await prisma.user.create({
		data: {
			name: `${PREFIX}admin-${run}`,
			email: `${PREFIX}admin-${run}@e2e.local`,
			isPlatformAdmin: true,
		},
	});
	adminUserId = admin.id;
	adminSessionToken = await createSession({
		userId: admin.id,
		ttlMs: 60 * 60 * 1000,
	});

	const target = await prisma.user.create({
		data: {
			name: `${PREFIX}target-${run}`,
			email: `${PREFIX}target-${run}@e2e.local`,
		},
	});
	targetUserId = target.id;

	const companyA = await prisma.companyAccount.create({
		data: { name: `${PREFIX}Acme Corp ${run}`, slug: `${PREFIX}acme-${run}` },
	});
	companyAId = companyA.id;
	const companyB = await prisma.companyAccount.create({
		data: { name: `${PREFIX}Beta Industries ${run}`, slug: `${PREFIX}beta-${run}` },
	});
	companyBId = companyB.id;

	await prisma.companyMember.createMany({
		data: [
			{ companyId: companyA.id, userId: target.id, role: 'OWNER' },
			{ companyId: companyB.id, userId: target.id, role: 'MEMBER' },
		],
	});

	const impersonationSession = await prisma.impersonationSession.create({
		data: {
			adminUserId: admin.id,
			targetUserId: target.id,
			reason: 'e2e: multi-company picker coverage',
			expiresAt: new Date(Date.now() + 30 * 60 * 1000),
		},
	});
	impersonationSessionId = impersonationSession.id;
});

test.afterAll(async () => {
	const prisma = getPrisma();
	if (impersonationSessionId) {
		await prisma.impersonationSession
			.delete({ where: { id: impersonationSessionId } })
			.catch(() => {});
	}
	const userIds = [adminUserId, targetUserId].filter(Boolean);
	const companyIds = [companyAId, companyBId].filter(Boolean);
	if (userIds.length > 0) {
		await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
	}
	if (companyIds.length > 0) {
		await prisma.companyMember.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.companyAccount.deleteMany({
			where: { id: { in: companyIds } },
		});
	}
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
	await disconnectPrisma();
});

test.describe('Impersonation multi-company picker (authenticated, dev server)', () => {
	test('sidebar Company link and /app/company both route through the picker instead of guessing the oldest company', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: adminSessionToken, url: baseURL },
			{ name: IMPERSONATION_COOKIE, value: impersonationSessionId, url: baseURL },
		]);

		await page.goto('/app');

		// The sidebar must not guess a company — it links to the bare picker.
		const companyLink = page.getByRole('link', { name: 'Company' });
		await expect(companyLink).toBeVisible();
		await expect(companyLink).toHaveAttribute('href', '/app/company');

		await companyLink.click();

		await expect(page).toHaveURL(/\/app\/company$/);
		await expect(
			page.getByRole('heading', { name: 'Select a company' }),
		).toBeVisible();

		const acmeLink = page.getByRole('link', { name: /Acme Corp/ });
		const betaLink = page.getByRole('link', { name: /Beta Industries/ });
		await expect(acmeLink).toHaveAttribute('href', `/app/company/${companyAId}`);
		await expect(betaLink).toHaveAttribute('href', `/app/company/${companyBId}`);

		await betaLink.click();
		await expect(page).toHaveURL(new RegExp(`/app/company/${companyBId}$`));
	});
});
