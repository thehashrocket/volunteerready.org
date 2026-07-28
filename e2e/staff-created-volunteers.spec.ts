// ---------------------------------------------------------------------------
// Staff-created volunteers — T15 (docs/designs/staff-created-volunteers.md).
//
// Two things no other test in the suite can do.
//
// 1. IDENTITY. Every other authenticated spec inserts a `Session` row and sets
//    the cookie, so nothing has ever executed NextAuth's callback route. The
//    UNCLAIMED -> ACTIVE flip lives in `events.signIn` (src/server/auth.ts),
//    and the reason it is that hook rather than `events.updateUser` is a claim
//    about next-auth's compiled internals. `auth-account-linking.test.ts`
//    asserts the hook is *registered*; only driving the real callback proves it
//    *fires*, and only the UI proves the badge a coordinator reads actually
//    changes. T9's verify note deferred that badge flip here.
//
// 2. LIFECYCLE. add -> assign -> attend -> hours-in-report crosses the roster,
//    the shift dialog and the analytics report. Each half has unit coverage;
//    nothing asserts a volunteer who never signed up ends up as hours in the
//    org's own report, which is the entire product promise of the feature.
//
// The magic link is minted, not mailed — see `mintMagicLinkUrl` in ./utils/db
// for why that still exercises the real chain.
//
// Parallelism: `fullyParallel` runs these two tests in separate workers, each
// with its own `beforeAll`. That is safe here because every fixture is keyed by
// a per-worker `run` suffix and `afterAll` deletes only ids/emails its own
// `beforeAll` produced — never a sweep on the shared PREFIX (CLAUDE.md).
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '../src/server/domain/feature-flags';
import {
	createSession,
	disconnectPrisma,
	getPrisma,
	mintMagicLinkUrl,
	SESSION_COOKIE_NAME,
} from './utils/db';

const PREFIX = '__t15_e2e__';

// Seeds sessions and rows into the .env.local database, which a remote target
// would not share (and https targets use the __Secure- cookie name).
const REMOTE_TARGET =
	!!process.env.PLAYWRIGHT_BASE_URL &&
	!/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL);
test.skip(
	REMOTE_TARGET,
	'staff-created-volunteers.spec.ts seeds the local database — remote targets unsupported',
);

// A shift whose length is not a whole number, so the hours assertion cannot
// pass on a coincidence (a count of 1, a default, a rounded-up integer).
const SHIFT_HOURS = 2.5;

let orgId: string;
let staffUserId: string;
let staffSessionToken: string;
let shiftId: string;
let shiftTitle: string;
/** Claimed by magic link in the identity test. */
let claimerEmail: string;
/** Stays UNCLAIMED so the suppression disclosure has something to disclose. */
let workerEmail: string;
let workerName: string;

test.beforeAll(async () => {
	const prisma = getPrisma();
	const run = randomUUID().slice(0, 8);

	claimerEmail = `${PREFIX}claimer-${run}@e2e.local`;
	workerEmail = `${PREFIX}worker-${run}@e2e.local`;
	workerName = `${PREFIX}Wanda ${run}`;
	shiftTitle = `${PREFIX}Saturday Kennel Shift ${run}`;

	const org = await prisma.organization.create({
		data: {
			name: `${PREFIX}Riverside ${run}`,
			slug: `t15-e2e-${run}`,
			// /app/analytics is planTierProcedure('PRO'); on FREE the report is
			// replaced by the upsell and the hours assertion never renders.
			planTier: 'PRO',
		},
	});
	orgId = org.id;

	const staff = await prisma.user.create({
		data: {
			name: `${PREFIX}coordinator-${run}`,
			email: `${PREFIX}coordinator-${run}@e2e.local`,
		},
	});
	staffUserId = staff.id;

	await prisma.organizationMember.create({
		data: { organizationId: org.id, userId: staff.id, role: 'OWNER' },
	});

	// The roster is dark by default (defaultEnabled: false), so every surface
	// under test — the nav item, /app/volunteers, the assign picker and the
	// disclosure — is withheld without this row.
	await prisma.featureFlag.create({
		data: { orgId: org.id, key: STAFF_CREATED_VOLUNTEERS_FLAG, enabled: true },
	});

	const startTime = new Date(Date.now() + 60 * 60 * 1000);
	const shift = await prisma.shift.create({
		data: {
			orgId: org.id,
			title: shiftTitle,
			startTime,
			endTime: new Date(startTime.getTime() + SHIFT_HOURS * 60 * 60 * 1000),
			// Room for the assignment without tripping the over-capacity confirm,
			// which has its own coverage in shiftSignupService.test.ts.
			capacity: 2,
		},
	});
	shiftId = shift.id;

	staffSessionToken = await createSession({
		userId: staff.id,
		currentOrgId: org.id,
		ttlMs: 60 * 60 * 1000,
	});
});

test.afterAll(async () => {
	const prisma = getPrisma();

	// The volunteers are created by the app, not by this file, so their ids are
	// recovered from the run-suffixed addresses rather than assumed.
	const volunteerEmails = [claimerEmail, workerEmail].filter(Boolean);
	const volunteers =
		volunteerEmails.length > 0
			? await prisma.user.findMany({
					where: { email: { in: volunteerEmails } },
					select: { id: true },
				})
			: [];
	const userIds = [staffUserId, ...volunteers.map((v) => v.id)].filter(Boolean);

	// ACCOUNT_CLAIMED rows carry no orgId (the actor is the subject), so an
	// org-scoped delete alone would leave them behind — and `actor` is
	// onDelete: SetNull, so they would survive the user delete as orphans.
	if (orgId || userIds.length > 0) {
		await prisma.auditLog.deleteMany({
			where: {
				OR: [
					...(orgId ? [{ orgId }] : []),
					...(userIds.length > 0
						? [{ actorId: { in: userIds } }, { entityId: { in: userIds } }]
						: []),
				],
			},
		});
	}

	// Organization cascades Shift -> ShiftSignup, OrgVolunteer, FeatureFlag and
	// Membership; User cascades VolunteerProfile, Session and its own signups.
	if (orgId) {
		await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
	}
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
	if (volunteerEmails.length > 0) {
		await prisma.verificationToken.deleteMany({
			where: { identifier: { in: volunteerEmails } },
		});
	}

	await disconnectPrisma();
});

/** Add a volunteer through the roster UI and return once the row is on screen. */
async function addVolunteerViaUi(
	page: import('@playwright/test').Page,
	name: string,
	email: string,
) {
	// The trigger renders twice once the empty state is up (header + empty
	// state), and the dialog's own submit carries the same name — so both the
	// open and the submit have to be scoped rather than matched by name alone.
	await page.getByRole('button', { name: 'Add volunteer' }).first().click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill(name);
	await dialog.getByLabel('Email').fill(email);
	await dialog.getByRole('button', { name: 'Add volunteer' }).click();

	await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
}

test.describe('Staff-created volunteers (authenticated, dev server)', () => {
	test('a volunteer who never signed up claims their account by magic link, and the roster badge flips', async ({
		context,
		page,
		baseURL,
		browser,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		const prisma = getPrisma();

		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
		]);

		await page.goto('/app/volunteers');
		await expect(
			page.getByRole('heading', { name: 'Volunteers' }),
		).toBeVisible();

		await addVolunteerViaUi(page, `${PREFIX}Casey`, claimerEmail);

		const row = page.getByRole('row').filter({ hasText: claimerEmail });
		await expect(row.getByText('No account yet')).toBeVisible();

		// The shadow user exists but nobody has ever authenticated as them.
		const before = await prisma.user.findUnique({
			where: { email: claimerEmail },
			select: { id: true, accountState: true, claimedAt: true },
		});
		expect(before?.accountState).toBe('UNCLAIMED');
		expect(before?.claimedAt).toBeNull();

		// --- the volunteer, in their own browser, opens the emailed link -------
		const volunteerContext = await browser.newContext();
		try {
			const volunteerPage = await volunteerContext.newPage();
			await volunteerPage.goto(
				await mintMagicLinkUrl({ email: claimerEmail, callbackUrl: '/app' }),
			);

			// next-auth signals every failure by redirecting to its error route
			// (?error=Verification for a bad/expired token, AccessDenied for a
			// refused signIn callback), so landing anywhere else is the pass.
			await expect(volunteerPage).not.toHaveURL(/\/api\/auth\/error/);

			const cookies = await volunteerContext.cookies();
			expect(
				cookies.some((c) => c.name === SESSION_COOKIE_NAME && !!c.value),
			).toBe(true);
		} finally {
			await volunteerContext.close();
		}

		// --- what the real callback chain did ---------------------------------
		const after = await prisma.user.findUnique({
			where: { email: claimerEmail },
			select: { id: true, accountState: true, claimedAt: true },
		});
		// Same row, adopted — not a second User created alongside the shadow.
		expect(after?.id).toBe(before?.id);
		expect(after?.accountState).toBe('ACTIVE');
		expect(after?.claimedAt).not.toBeNull();

		expect(
			await prisma.session.count({ where: { userId: after?.id } }),
		).toBeGreaterThan(0);

		// Proves the flip ran through claimAccountOnSignIn rather than some other
		// write — the audit row is only written on that path.
		expect(
			await prisma.auditLog.count({
				where: { action: 'ACCOUNT_CLAIMED', entityId: after?.id },
			}),
		).toBe(1);

		// --- and what the coordinator now sees --------------------------------
		await page.reload();
		const flipped = page.getByRole('row').filter({ hasText: claimerEmail });
		await expect(flipped.getByText('Has account')).toBeVisible();
		await expect(flipped.getByText('No account yet')).toHaveCount(0);
	});

	test('a staff-added volunteer can be assigned to a shift, marked attended, and shows up as hours in the report', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		const prisma = getPrisma();

		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
		]);

		// --- add -------------------------------------------------------------
		await page.goto('/app/volunteers');
		await addVolunteerViaUi(page, workerName, workerEmail);

		// --- assign ------------------------------------------------------------
		await page.goto('/app/shifts');
		// `exact` matters: the row's Complete/Cancel/Delete icon buttons all carry
		// the shift title inside their aria-label.
		await page.getByRole('button', { name: shiftTitle, exact: true }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('heading', { name: shiftTitle })).toBeVisible();
		await expect(dialog.getByText('No signups yet')).toBeVisible();

		await dialog.getByRole('button', { name: 'Assign volunteer' }).click();
		// The picker is a server-searched list keyed by OrgVolunteer.id; the
		// client has no join key to filter it, so this is the only place the
		// candidate set can be proven correct.
		await page.getByRole('option', { name: new RegExp(workerName) }).click();

		const signupRow = dialog.getByRole('row').filter({ hasText: workerName });
		await expect(signupRow).toBeVisible();

		// T23: the coordinator must be told this person will NOT be reminded.
		// Curly apostrophe, as rendered.
		await expect(
			dialog.getByText(
				'1 volunteer won’t get an automatic reminder — no account yet.',
			),
		).toBeVisible();

		// --- attend ------------------------------------------------------------
		await signupRow.getByRole('button', { name: 'Attended' }).click();
		await expect(dialog.getByText('1/1 checked in')).toBeVisible();

		const volunteer = await prisma.user.findUnique({
			where: { email: workerEmail },
			select: { id: true },
		});
		const signup = await prisma.shiftSignup.findFirst({
			where: { shiftId, userId: volunteer?.id },
			select: { status: true },
		});
		expect(signup?.status).toBe('ATTENDED');

		// --- hours in the report ------------------------------------------------
		await page.goto('/app/analytics');
		await expect(
			page.getByRole('heading', { name: 'Top Volunteers' }),
		).toBeVisible();

		const reportRow = page.getByRole('row').filter({ hasText: workerName });
		await expect(reportRow).toBeVisible();
		// Hours are derived from the shift's own duration, so this asserts the
		// figure and not merely that a row appeared. `exact` because the default
		// substring match would also accept "12.5", or a date that contains "2.5".
		await expect(
			reportRow.getByText(String(SHIFT_HOURS), { exact: true }),
		).toBeVisible();
	});
});
