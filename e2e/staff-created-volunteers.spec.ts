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
// Parallelism: `fullyParallel` CAN run these tests in separate workers, each
// with its own `beforeAll`. That is safe because every fixture is keyed by a
// per-worker `run` suffix and `afterAll` deletes only ids/emails its own
// `beforeAll` produced — never a sweep on the shared PREFIX (CLAUDE.md).
//
// Do NOT read that as isolation you can rely on: CI sets `workers: 1`, so there
// the tests share ONE `beforeAll` org and run in declaration order. The identity
// test's T25 regression guard needs a genuinely EMPTY roster (it opens the
// empty-state action, which only renders at zero rows), so it must stay first
// among the tests that write to this org. It asserts that precondition rather
// than assuming it — see `addVolunteersViaUi`.
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
import {
	expectNoHorizontalOverflow,
	expectNoInternalScroll,
} from './utils/layout';

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
/** Added through the Drawer in the 375px test. */
let mobileEmail: string;
let mobileName: string;
/** The second name typed into the OPEN sheet at 375px — T25 repeat entry. */
let mobileSecondEmail: string;
let mobileSecondName: string;
/** Seeded directly for the 768-1023px band test. */
let tabletEmail: string;
/** The SECOND name typed into one open form — T25's empty-state regression. */
let batchEmail: string;
let batchName: string;

test.beforeAll(async () => {
	const prisma = getPrisma();
	const run = randomUUID().slice(0, 8);

	claimerEmail = `${PREFIX}claimer-${run}@e2e.local`;
	workerEmail = `${PREFIX}worker-${run}@e2e.local`;
	workerName = `${PREFIX}Wanda ${run}`;
	mobileEmail = `${PREFIX}mobile-${run}@e2e.local`;
	mobileName = `${PREFIX}Mo ${run}`;
	mobileSecondEmail = `${PREFIX}mobile2-${run}@e2e.local`;
	mobileSecondName = `${PREFIX}Moe ${run}`;
	tabletEmail = `${PREFIX}tablet-${run}@e2e.local`;
	batchEmail = `${PREFIX}batch-${run}@e2e.local`;
	batchName = `${PREFIX}Bea ${run}`;
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
	const volunteerEmails = [
		claimerEmail,
		workerEmail,
		mobileEmail,
		mobileSecondEmail,
		tabletEmail,
		batchEmail,
	].filter(
		Boolean,
	);
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

/**
 * Add one or more volunteers through the roster UI in a SINGLE open session,
 * and return once every row is on screen.
 *
 * TWO entries opened from `'empty-state'` is the regression test for T25's
 * empty-state hazard. Both halves are required: the first add flips
 * `volunteers.length === 0` and unmounts that whole branch, so a form mounted
 * inside it goes with it, taking the half-typed second volunteer. One add
 * cannot catch that (nothing has been unmounted yet), and opening from the
 * header cannot either (that instance was never at risk).
 */
async function addVolunteersViaUi(
	page: import('@playwright/test').Page,
	entries: readonly { name: string; email: string }[],
	openFrom: 'header' | 'empty-state' = 'header',
) {
	// WHICH trigger opens the form is load-bearing, not a detail. Both carry the
	// accessible name `Add volunteer`, so `.first()` always resolves to the
	// header's — and the header's dialog was never the one at risk. Opening from
	// the empty state is the only sequence the pre-lift two-dialog design fails,
	// because that is the instance the first add unmounts. A two-entry batch
	// opened from the header passes under BOTH designs and proves nothing.
	if (openFrom === 'empty-state') {
		// Only rendered while the roster has zero rows. Asserted, not assumed:
		// under CI's `workers: 1` these tests share an org in declaration order, so
		// a future roster-writing test added above this one would otherwise turn
		// the regression guard into a confusing locator timeout.
		const emptyStateAdd = page.getByTestId('empty-roster-add-volunteer');
		await expect(emptyStateAdd).toBeVisible();
		await emptyStateAdd.click();
	} else {
		await page.getByRole('button', { name: 'Add volunteer' }).first().click();
	}

	const dialog = page.getByRole('dialog');

	for (const [i, entry] of entries.entries()) {
		await dialog.getByLabel('Name').fill(entry.name);
		await dialog.getByLabel('Email').fill(entry.email);
		// The submit RELABELS to `Add another` after the first success, so naming
		// the button per iteration asserts that flip rather than assuming it —
		// and a form that closed on success would fail here on the second pass
		// with nothing to click.
		await dialog
			.getByRole('button', { name: i === 0 ? 'Add volunteer' : 'Add another' })
			.click();
		await expect(dialog.getByText(`${i + 1} added`)).toBeVisible();
	}

	// Radix marks everything outside an open modal `aria-hidden` and Playwright's
	// role selectors honour the accessibility tree, so the roster behind the form
	// is unreachable by role until it is dismissed.
	await dialog.getByRole('button', { name: 'Done' }).click();

	for (const entry of entries) {
		await expect(
			page.getByRole('row').filter({ hasText: entry.email }),
		).toBeVisible();
	}
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

		await addVolunteersViaUi(
			page,
			[
				{ name: `${PREFIX}Casey`, email: claimerEmail },
				// Typed into the SAME open form, after the add above has already
				// emptied the empty state out from under it.
				{ name: batchName, email: batchEmail },
			],
			// From the empty state specifically — see the helper. This is the
			// regression guard for the form being unmounted mid-batch.
			'empty-state',
		);

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
		// STILL QUARANTINED IN CI. Tracked as a P2 in `docs/TODOS.md`, which
		// carries the full diagnosis and now FOUR refuted hypotheses.
		//
		// It was briefly un-quarantined in v0.41.18.0 on the theory that the
		// service worker caused it — `sw.js` pre-cached `['/app',
		// '/app/my-shifts']` at install from a component mounted in the root
		// layout with no environment guard, so on a cold runner this test's first
		// navigation also paid for two route compiles it never asked for. That
		// explained the one unexplained clue in the P2 (a `/app/my-shifts`
		// request during a staff session) and it was a real defect, fixed in the
		// same release. **It was not this test's cause.** With the pre-caching
		// gone the test failed all three attempts on CI, identically.
		//
		// What that run did NOT refute: `sw.js` still calls `clients.claim()`, so
		// the worker still takes over a page that may still be hydrating. That is
		// the live hypothesis for whoever picks this up, and it is testable —
		// unregister the worker at the top of this spec and see.
		//
		// `fixme`, deliberately, NOT `skip` and NOT deletion:
		//   - it still RUNS locally, where it passes, so the coverage is not lost
		//     and a regression in the behaviour it asserts still surfaces
		//   - it is REPORTED as skipped in every CI run, so the quarantine
		//     announces itself instead of quietly becoming permanent
		//
		// Un-quarantine by deleting these two lines once the P2 is fixed — and
		// note that this has now been attempted once and reverted, so the bar is
		// a CI run that proves it, not a theory that explains it.
		test.fixme(
			!!process.env.CI,
			'P2 in docs/TODOS.md — fails on a slow CI runner, not reproducible locally',
		);

		if (!baseURL) throw new Error('baseURL missing from Playwright config');
		const prisma = getPrisma();

		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
		]);

		// --- add -------------------------------------------------------------
		await page.goto('/app/volunteers');
		await addVolunteersViaUi(page, [{ name: workerName, email: workerEmail }]);

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

		// --- the same shift, in the volunteer's detail dialog (T27) --------------
		// End-to-end proof of the org-scoped read: a real ATTENDED signup written
		// by the step above, resurfacing through
		// `listAttendedShiftsForUserInOrg`. The integration test proves the join
		// excludes another org's rows; this proves it INCLUDES this org's, which
		// a `where` that scoped too tightly would silently fail.
		await page.goto('/app/volunteers');
		await page.getByTestId('roster-table').waitFor();
		await page
			.getByTestId('roster-table')
			// `exact`, because Remove's accessible name is "Remove {name} from
			// your roster" — it CONTAINS the name, so a substring match resolves
			// to both controls in the row.
			.getByRole('button', { name: workerName, exact: true })
			.click();

		// By `data-slot`, not `getByRole('dialog')`: the cookie-consent banner is
		// also a `role="dialog"`, so the role alone is ambiguous on any page that
		// has not had consent dismissed.
		//
		// A centred Dialog at this width, not the bottom sheet the 375px test
		// asserts — the two shells are the reason both viewports are covered.
		const detail = page.locator('[data-slot="dialog-content"]');
		await expect(detail).toBeVisible();
		await expect(detail.getByText(shiftTitle)).toBeVisible();
		// Hours summed from that one shift. Same figure the report shows below,
		// from a completely different query — if these ever disagree, one of the
		// two is scoped wrong.
		await expect(
			detail.getByText(`1 attended · ${SHIFT_HOURS} hours`),
		).toBeVisible();
		await page.keyboard.press('Escape');

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

test.describe('Roster on a phone (T28, 375px)', () => {
	test('the roster reads as cards with no sideways scroll, and the add form is a bottom sheet', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL is required');

		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
		]);
		// The only viewport that proves any of this: the table/card switch is pure
		// CSS, so jsdom — which has no layout — cannot tell which tree a human
		// sees. Both are always in the DOM.
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/volunteers');

		// --- the add form is a Drawer, not a centred dialog ----------------------
		await page.getByRole('button', { name: 'Add volunteer' }).first().click();
		const sheet = page.getByRole('dialog');
		await expect(sheet).toHaveAttribute('data-slot', 'drawer-content');

		await sheet.getByLabel('Name').fill(mobileName);
		await sheet.getByLabel('Email').fill(mobileEmail);
		await sheet.getByRole('button', { name: 'Add volunteer' }).click();

		// T25's repeat entry, at the width it matters most, and it takes a SECOND
		// name to show it: one add proves the sheet stayed open, not that another
		// volunteer can be entered without reopening it. The drawer is where vaul
		// owns focus and animation, so this is the only non-jsdom evidence that
		// clearing the fields and returning focus works on a phone.
		//
		// The count is the only durable confirmation of how many landed — the
		// toasts are transient and the roster is behind the sheet.
		await expect(sheet.getByText('1 added')).toBeVisible();

		await sheet.getByLabel('Name').fill(mobileSecondName);
		await sheet.getByLabel('Email').fill(mobileSecondEmail);
		await sheet.getByRole('button', { name: 'Add another' }).click();
		await expect(sheet.getByText('2 added')).toBeVisible();
		await sheet.getByRole('button', { name: 'Done' }).click();
		// Asserted on the drawer's own slot, NOT on `sheet`. `getByRole('dialog')`
		// also matches the cookie-preferences banner; that only resolves to one
		// node while a modal is open, because Radix marks everything outside it
		// `aria-hidden`. The moment the sheet closes the banner comes back and
		// `expect(sheet).toBeHidden()` fails against the wrong element.
		await expect(page.locator('[data-slot="drawer-content"]')).toBeHidden();

		// --- the card list is what renders, and the table is not -----------------
		const cards = page.getByTestId('roster-card-list');
		await expect(cards.getByText(mobileEmail)).toBeVisible();
		await expect(page.getByTestId('roster-table')).toBeHidden();

		// The table-column regression T28 exists to kill is caught by the
		// `roster-table` toBeHidden() assertion above; what THIS measures is that
		// the card content itself (long names, long addresses) stays inside 375px.
		//
		// Document-level as of the app-shell overflow fix. It was scoped to the
		// roster region while the shell's own top bar overflowed ~22px here on
		// every authenticated page; that was a real limitation, and the point of
		// widening it is that it now catches a new offender in SHARED chrome, not
		// only one inside the region someone remembered to scope to.
		await expectNoHorizontalOverflow(page, 375);

		// And the list must not carry its own internal sideways scroll — the
		// failure mode `Table`'s `overflow-auto` wrapper produces, which is what
		// this replaced, and which the assertion above cannot see because the
		// document stays exactly 375 while the table scrolls inside it.
		await expectNoInternalScroll(page, '[data-testid="roster-card-list"]');

		// T28 shipped `Remove` on the card as a tracked deviation from the
		// approved spec, because until T27 existed honouring the spec literally
		// would have left a phone unable to remove anyone at all. T27 built the
		// dialog, so the spec's placement now holds: the row is the tap target,
		// and Remove lives one tap deeper.
		await expect(
			cards.getByRole('button', {
				name: `Remove ${mobileName} from your roster`,
			}),
		).toBeHidden();

		// --- the detail dialog is a bottom sheet too -----------------------------
		// The ONLY environment that proves it. The unit tests pin `useMediaQuery`
		// to desktop, so every one of them exercises the Dialog branch; nothing
		// but a real 375px viewport shows which shell a human gets, and vaul owns
		// focus and animation only in this one.
		await cards.getByRole('button', { name: `View ${mobileName}` }).click();

		// By `data-slot`, not `getByRole('dialog')` — the cookie-consent banner is
		// also a `role="dialog"`, so the role alone matches two things here.
		const detail = page.locator('[data-slot="drawer-content"]');
		await expect(detail).toBeVisible();
		await expect(detail.getByText(mobileEmail)).toBeVisible();
		// The STAFF-voiced Record. The volunteer-voiced one says "Added by their
		// staff", which on this surface reads as some OTHER org's staff.
		await expect(detail.getByText('Added by your team')).toBeVisible();

		// No sideways scroll with the sheet OPEN. The assertion above runs before
		// the drawer exists and is scoped to the card list, so nothing covered the
		// drawer itself — and a grid item without `min-w-0` overflows on a long
		// address exactly here, which is the failure T28 exists to prevent.
		await expectNoInternalScroll(page, '[data-slot="drawer-content"]');
		// Document-level too, now that the shell is fixed. This one runs with the
		// sheet OPEN, which the check before the drawer existed could not cover —
		// and a grid item without `min-w-0` overflows on a long address exactly
		// here.
		await expectNoHorizontalOverflow(page, 375);

		// The control that moved. Removing from here has to drive the page's one
		// mutation, so the Undo toast still appears and the row still goes.
		await detail
			.getByRole('button', { name: `Remove ${mobileName} from your roster` })
			.click();

		await expect(detail).toBeHidden();
		await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
		await expect(cards.getByText(mobileName)).toBeHidden();
	});
});


test.describe('Roster in the tablet band (R4, 800px)', () => {
	test('search and Export CSV stack, and the card list is what renders', async ({
		context,
		page,
		baseURL,
	}) => {
		if (!baseURL) throw new Error('baseURL is required');

		// 800px is the band this ship changed: the controls row moved from
		// `sm:flex-row` (side by side from 640px) to `lg:flex-row`, so between
		// 768 and 1023 they now STACK where they previously shared a row. That
		// is a layout change for every existing user at this width, and no unit
		// test can see it — jsdom has no layout engine and evaluates no media
		// query, so only a real viewport proves it.
		const prisma = getPrisma();
		const volunteer = await prisma.user.create({
			data: { name: `${PREFIX}Tessa`, email: tabletEmail },
		});
		await prisma.orgVolunteer.create({
			data: {
				orgId,
				userId: volunteer.id,
				displayName: `${PREFIX}Tessa`,
				source: 'STAFF_ADDED',
				addedByUserId: staffUserId,
			},
		});

		await context.addCookies([
			{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
		]);
		await page.setViewportSize({ width: 800, height: 900 });
		await page.goto('/app/volunteers');
		await page.getByTestId('roster-card-list').waitFor();

		// Below `lg`, so the card list is what a human sees here too — the page
		// has ONE breakpoint, which is the whole reason the controls row moved.
		await expect(page.getByTestId('roster-table')).toBeHidden();

		const search = page.getByLabel('Search volunteers');
		const exportLink = page.getByTestId('export-roster-csv');
		const searchBox = await search.boundingBox();
		const exportBox = await exportLink.boundingBox();
		if (!searchBox || !exportBox) throw new Error('controls not laid out');

		// Stacked, not side by side: the export control sits BELOW the search
		// field rather than beside it. Asserting on geometry rather than class
		// names, so the test survives a refactor that keeps the behaviour.
		expect(exportBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height);

		// And the search field takes the full column rather than a half-row.
		expect(searchBox.width).toBeGreaterThan(600);

		// This band is where the shell overflow was WORST — 926 against an 800px
		// viewport, a 126px overhang versus 22px at 375px, because the wordmark
		// and both switchers all render here beside a toggle that is still
		// `lg:hidden`. Anyone who tested the fix on a phone alone would have
		// concluded it was a rounding error, so this assertion is the one that
		// actually holds the shell fix in place.
		await expectNoHorizontalOverflow(page, 800);
	});
});
