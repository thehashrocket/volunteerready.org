// ---------------------------------------------------------------------------
// T36 — the four remaining staff tables on a phone.
//
// `/app/volunteers` got the table/card treatment in T28 and is covered by
// `staff-created-volunteers.spec.ts`. These four followed: applications,
// opportunities, shifts and settings/team.
//
// This spec exists because the unit tests structurally CANNOT cover the
// deliverable. The table/card switch is pure CSS — both trees are always in the
// DOM and only a media query decides which paints — and jsdom has no layout
// engine and evaluates no media query. The unit tests can prove both trees
// exist and carry the right classes; only a real 375px viewport proves which
// one a human sees, and only a real viewport can measure overflow at all.
//
// The overflow assertions are DOCUMENT-level (`expectNoHorizontalOverflow`).
// They could not be until the app-shell top bar was fixed in this same ship —
// it overflowed on every authenticated page, so a page-level assertion failed
// on shared chrome and said nothing about the page under test. See
// `e2e/utils/layout.ts`.
//
// Parallelism: `fullyParallel` can put these in separate workers, each with its
// own `beforeAll`. Every fixture is keyed by a per-worker `run` suffix and
// `afterAll` deletes only the ids its own `beforeAll` produced — never a sweep
// on the shared PREFIX (CLAUDE.md).
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '../src/server/domain/feature-flags';
import {
	createSession,
	disconnectPrisma,
	getPrisma,
	SESSION_COOKIE_NAME,
} from './utils/db';
import {
	expectEllipsized,
	expectNoHorizontalOverflow,
	expectNoInternalScroll,
} from './utils/layout';

const PREFIX = '__t36_e2e__';

const REMOTE_TARGET =
	!!process.env.PLAYWRIGHT_BASE_URL &&
	!/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL);
test.skip(
	REMOTE_TARGET,
	'staff-tables-mobile.spec.ts seeds the local database — remote targets unsupported',
);

const PHONE = { width: 375, height: 812 };

let orgId: string;
/** A SECOND org, so the header renders OrgSwitcher's dropdown rather than its
 *  single-membership label — the widest state the top bar has, and one no
 *  fixture rendered before. */
let secondOrgId: string;
/** TWO companies, for the same reason there are two orgs: `CompanySwitcher`
 *  renders its dropdown trigger only at `memberships.length > 1` — with a
 *  single membership it falls through to the `max-w-24` label branch, so a
 *  one-company fixture does NOT exercise the trigger the width cap is on.
 *  Caught in review after the first version seeded one and claimed otherwise. */
let companyId: string;
let secondCompanyId: string;
let staffUserId: string;
let memberUserId: string;
let staffSessionToken: string;

/**
 * Deliberately long, and deliberately UNBREAKABLE.
 *
 * A name with spaces wraps and never proves anything about `min-w-0`. So did
 * the first version of these fixtures, which used hyphens — a hyphen is a
 * line-break opportunity (UAX #14 class BA) and browsers break after it, so
 * removing `truncate` would have left the text wrapping harmlessly and the
 * assertions green. Underscores and letters only: `_` is not a break
 * opportunity, so the whole string is one unbreakable run and a flex child
 * without `min-w-0` + `truncate` genuinely widens past the viewport.
 */
let longEmail: string;
let longTitle: string;
let shiftTitle: string;

test.beforeAll(async () => {
	const prisma = getPrisma();
	const run = randomUUID().slice(0, 8);

	longEmail = `${PREFIX}an_unreasonably_long_volunteer_address_${run}@example.local`;
	longTitle = `${PREFIX}Saturday_Morning_Kennel_Deep_Clean_And_Dog_Walking_${run}`;
	shiftTitle = `${PREFIX}Saturday_Morning_Shift_${run}`;

	const org = await prisma.organization.create({
		data: {
			name: `${PREFIX}Riverside ${run}`,
			slug: `t36-e2e-${run}`,
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

	// A second member so the team card list has a row with live controls — the
	// OWNER row and the caller's own row both render "You"/"—" instead.
	// Underscores only — see the fixture note above. The first version used
	// `Bo Helper` with a space and a hyphenated address, both line-break
	// opportunities, so deleting `truncate` from the team card would have wrapped
	// harmlessly and left the assertions green.
	const member = await prisma.user.create({
		data: {
			name: `${PREFIX}Bo_Helper_With_A_Very_Long_Name_${run}`,
			email: `${PREFIX}member_${run}@e2e.local`,
		},
	});
	memberUserId = member.id;
	await prisma.organizationMember.create({
		data: { organizationId: org.id, userId: member.id, role: 'STAFF' },
	});

	const opportunity = await prisma.volunteerOpportunity.create({
		data: {
			orgId: org.id,
			title: longTitle,
			description: 'Seeded by staff-tables-mobile.spec.ts',
			// PUBLISHED so the card renders `Close`, which is the action that
			// exists on this list and nowhere else — the point of keeping actions
			// on the card rather than pushing them into a detail view.
			status: 'PUBLISHED',
			location: 'Fresno, CA',
			capacity: 12,
		},
	});

	await prisma.volunteerApplication.create({
		data: {
			orgId: org.id,
			opportunityId: opportunity.id,
			submittedByEmail: longEmail,
			status: 'SUBMITTED',
			screeningStatus: 'REVIEW',
			// Two reasons so the card's flags badge has something to render — the
			// one cell the phone keeps because it is the "this needs you" signal.
			screeningReasons: ['dob_missing', 'name_mismatch'],
		},
	});

	const startTime = new Date(Date.now() + 60 * 60 * 1000);
	await prisma.shift.create({
		data: {
			orgId: org.id,
			opportunityId: opportunity.id,
			title: shiftTitle,
			startTime,
			endTime: new Date(startTime.getTime() + 3 * 60 * 60 * 1000),
			location: 'Main kennel',
			capacity: 10,
		},
	});

	// A second org and a company membership exist ONLY so the two switchers
	// render their dropdown-trigger variants. Those triggers are the widest
	// elements in the top bar (`max-w-[120px] sm:max-w-[180px] lg:max-w-[220px]`
	// plus a chevron), they are the reason the tablet band overflowed by 126px,
	// and every previous fixture seeded one org and zero companies — so the
	// states the fix is really about were never on screen in any test.
	// Deliberately long, unbreakable names so a dropped cap has something to
	// overflow with.
	const secondOrg = await prisma.organization.create({
		data: {
			name: `${PREFIX}Second_Organization_With_A_Very_Long_Name_${run}`,
			slug: `t36-e2e-second-${run}`,
		},
	});
	secondOrgId = secondOrg.id;
	await prisma.organizationMember.create({
		data: { organizationId: secondOrg.id, userId: staff.id, role: 'OWNER' },
	});

	const company = await prisma.companyAccount.create({
		data: {
			name: `${PREFIX}Sponsoring_Corporation_With_A_Long_Name_${run}`,
			slug: `t36-e2e-co-${run}`,
		},
	});
	companyId = company.id;
	await prisma.companyMember.create({
		data: { companyId: company.id, userId: staff.id, role: 'OWNER' },
	});

	const secondCompany = await prisma.companyAccount.create({
		data: {
			name: `${PREFIX}Another_Sponsoring_Corporation_${run}`,
			slug: `t36-e2e-co2-${run}`,
		},
	});
	secondCompanyId = secondCompany.id;
	await prisma.companyMember.create({
		data: { companyId: secondCompany.id, userId: staff.id, role: 'OWNER' },
	});

	// `/app/volunteers` is behind the roster flag and its layout redirects to
	// `/app` without it, so the top-bar test was measuring the dashboard rather
	// than the page it named. The sibling roster spec seeds this too.
	await prisma.featureFlag.create({
		data: { orgId: org.id, key: STAFF_CREATED_VOLUNTEERS_FLAG, enabled: true },
	});

	// One roster row, so `/app/volunteers` renders its two trees rather than the
	// empty state — the desktop-contrast test asserts `roster-table` is visible,
	// and an empty roster renders neither tree.
	await prisma.orgVolunteer.create({
		data: {
			orgId: org.id,
			userId: member.id,
			displayName: `${PREFIX}Bo_Helper_With_A_Very_Long_Name_${run}`,
			source: 'STAFF_ADDED',
			addedByUserId: staff.id,
		},
	});

	staffSessionToken = await createSession({
		userId: staff.id,
		currentOrgId: org.id,
		currentCompanyId: company.id,
		ttlMs: 60 * 60 * 1000,
	});
});

test.afterAll(async () => {
	const prisma = getPrisma();
	const userIds = [staffUserId, memberUserId].filter(Boolean);

	if (orgId || userIds.length > 0) {
		await prisma.auditLog.deleteMany({
			where: {
				OR: [
					...(orgId ? [{ orgId }] : []),
					...(userIds.length > 0 ? [{ actorId: { in: userIds } }] : []),
				],
			},
		});
	}
	// Organization cascades VolunteerOpportunity -> VolunteerApplication and
	// Shift, plus OrganizationMember; User cascades Session.
	if (orgId) {
		await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
	}
	if (secondOrgId) {
		await prisma.organization
			.delete({ where: { id: secondOrgId } })
			.catch(() => {});
	}
	for (const id of [companyId, secondCompanyId].filter(Boolean)) {
		await prisma.companyAccount.delete({ where: { id } }).catch(() => {});
	}
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}

	await disconnectPrisma();
});

test.beforeEach(async ({ context, baseURL }) => {
	if (!baseURL) throw new Error('baseURL is required');
	await context.addCookies([
		{ name: SESSION_COOKIE_NAME, value: staffSessionToken, url: baseURL },
	]);
});

test.describe('Staff tables on a phone (T36, 375px)', () => {
	test('applications: cards replace the table, flags survive, nothing scrolls sideways', async ({
		page,
	}) => {
		await page.setViewportSize(PHONE);
		await page.goto('/app/applications');

		const cards = page.getByTestId('applications-card-list');
		await cards.waitFor();
		await expect(page.getByTestId('applications-table')).toBeHidden();

		// The address is the identity on this row and the longest thing on it —
		// the one that would widen the card without `min-w-0` + `truncate`.
		await expect(cards.getByText(longEmail)).toBeVisible();
		// Flags stay on the phone. Dropping them would make the phone a worse
		// triage surface than the desktop rather than a narrower one.
		await expect(cards.getByText('2 flags')).toBeVisible();
		// Screening does not — it is reference detail one tap away.
		await expect(cards.getByText('Needs review')).toBeHidden();

		// The row is a real link, so it is keyboard-reachable and
		// middle-clickable. The desktop table's `router.push` on a `<tr>` is
		// neither; that gap is deliberately not copied down.
		await expect(
			cards.getByRole('link', { name: `View application from ${longEmail}` }),
		).toBeVisible();

		await expectNoHorizontalOverflow(page, PHONE.width);
		await expectNoInternalScroll(page, '[data-testid="applications-card-list"]');

		// `truncate` is actually ENGAGING on the address — see `expectEllipsized`.
		await expectEllipsized(
			page,
			'[data-testid="applications-card-list"] .truncate.font-medium',
		);
	});

	test('opportunities: the state-transition action stays reachable on the card', async ({
		page,
	}) => {
		await page.setViewportSize(PHONE);
		await page.goto('/app/opportunities');

		const cards = page.getByTestId('opportunities-card-list');
		await cards.waitFor();
		await expect(page.getByTestId('opportunities-table')).toBeHidden();

		// The assertion this page exists for. `Publish`/`Close` live on this list
		// and NOWHERE else — the opportunity detail page has only `Edit` — so a
		// whole-row card following the roster's shape literally would have been a
		// phone that cannot publish an opportunity.
		await expect(
			cards.getByRole('button', { name: `Close "${longTitle}"` }),
		).toBeVisible();
		await expect(
			cards.getByRole('link', { name: longTitle }),
		).toBeVisible();

		await expectNoHorizontalOverflow(page, PHONE.width);
		await expectNoInternalScroll(
			page,
			'[data-testid="opportunities-card-list"]',
		);
		await expectEllipsized(
			page,
			'[data-testid="opportunities-card-list"] a.truncate',
		);

		// The header's actions must stay inside the same content column as the
		// title. This page is why the assertion exists: its filter Select plus
		// "New opportunity" is 343px of content in a 311px column, and before
		// `PageHeader` got `min-w-0 flex-wrap` (and this page stopped nesting a
		// second flex row inside it) the row ran past the page padding to sit
		// flush against the viewport edge.
		//
		// `expectNoHorizontalOverflow` did NOT catch that, and the reason is worth
		// keeping: the overhang happened to stop at exactly 375, so
		// `documentElement.scrollWidth` was still 375. A document-level check is
		// necessary but not sufficient — it cannot see content that breaks its
		// container yet lands inside the viewport by luck.
		const bounds = await page.evaluate(() => {
			const h1 = document.querySelector('h1');
			const actions = h1?.parentElement?.nextElementSibling;
			if (!h1 || !actions) return null;
			// The WIDEST DESCENDANT, not the actions wrapper itself. Measuring the
			// wrapper is what an earlier version of this did, and it could not see
			// the defect it was written for: the page nested a second flex row
			// inside `PageHeader`'s, so the outer wrapper stayed within bounds
			// while the inner one — and the button in it — hung past the edge.
			let worst = 0;
			let offender = '';
			for (const el of [actions, ...Array.from(actions.querySelectorAll('*'))]) {
				const r = el.getBoundingClientRect();
				if (r.width > 0 && r.right > worst) {
					worst = r.right;
					offender = `${el.tagName.toLowerCase()}.${String(el.className)}`;
				}
			}
			return {
				titleRight: Math.round(h1.getBoundingClientRect().right),
				actionsRight: Math.round(worst),
				offender,
			};
		});
		expect(bounds, 'page header not laid out as expected').not.toBeNull();
		expect(
			bounds?.actionsRight,
			`header actions escaped the content column; widest node is ${bounds?.offender}`,
		).toBeLessThanOrEqual(bounds?.titleRight ?? -1);
	});

	test('shifts: coverage reads at a glance and the lifecycle actions stay', async ({
		page,
	}) => {
		await page.setViewportSize(PHONE);
		await page.goto('/app/shifts');

		const cards = page.getByTestId('shifts-card-list');
		await cards.waitFor();
		await expect(page.getByTestId('shifts-table')).toBeHidden();

		// "Is Saturday covered?" — the question this page is opened on a phone to
		// answer.
		await expect(cards.getByText(/Main kennel · 0\/10 signed up/)).toBeVisible();
		await expect(
			cards.getByRole('button', { name: `Mark "${shiftTitle}" complete` }),
		).toBeVisible();

		await expectNoHorizontalOverflow(page, PHONE.width);
		await expectNoInternalScroll(page, '[data-testid="shifts-card-list"]');
		await expectEllipsized(
			page,
			'[data-testid="shifts-card-list"] button.truncate',
		);

		// The per-row detail dialog is rendered in BOTH trees; `display: none`
		// takes the desktop one out of the accessibility tree, so this click can
		// only reach the card's. If that ever stopped being true, Playwright would
		// fail here on strict-mode ambiguity rather than silently driving the
		// hidden tree.
		// `exact` because the three action buttons' accessible names all CONTAIN
		// the title (`Mark "…" complete`), and Playwright's default name match is
		// a substring one — without it this is four candidates, not one.
		await cards
			.getByRole('button', { name: shiftTitle, exact: true })
			.click();
		// By `data-slot`, NOT `getByRole('dialog')`: the cookie-preferences banner
		// is also a `role="dialog"`. The role resolves to one node only while a
		// modal is open (Radix marks everything outside it `aria-hidden`), so the
		// moment this closes the banner comes back and the role match is
		// ambiguous. Same trap `staff-created-volunteers.spec.ts` records.
		const detail = page.locator('[data-slot="dialog-content"]');
		await expect(detail).toBeVisible();
		// And the dialog itself has to fit, which is where a grid item without
		// `min-w-0` shows up.
		await expectNoHorizontalOverflow(page, PHONE.width);

		// Crossing `lg` with the dialog open does NOT close it. This is here
		// because the code comment used to claim the opposite, and the claim was
		// the justification for a design decision (per-row dialogs rather than one
		// page-owned one). The switch is CSS so React unmounts nothing, and Radix
		// portals the content to `document.body`, outside the subtree
		// `display: none` hides. Asserting it means the comment cannot rot back.
		await page.setViewportSize({ width: 1200, height: 900 });
		await expect(detail).toBeVisible();
		await page.setViewportSize(PHONE);
		await page.keyboard.press('Escape');
		await expect(detail).toBeHidden();

	});

	test('team: both member controls stay on the card', async ({ page }) => {
		await page.setViewportSize(PHONE);
		await page.goto('/app/settings/team');

		const cards = page.getByTestId('team-card-list');
		await cards.waitFor();
		await expect(page.getByTestId('team-table')).toBeHidden();

		// There is no member detail view to move these into, so unlike the roster
		// they stay on the row — at 44px rather than the table's 32px.
		const memberName = (await cards
			.getByText(new RegExp(`${PREFIX}Bo_Helper`))
			.first()
			.textContent()) as string;
		await expect(
			cards.getByRole('button', {
				name: `Remove ${memberName} from this organization`,
			}),
		).toBeVisible();
		await expect(
			cards.getByRole('combobox', { name: `Role for ${memberName}` }),
		).toBeVisible();

		await expectNoHorizontalOverflow(page, PHONE.width);
		await expectNoInternalScroll(page, '[data-testid="team-card-list"]');
		await expectEllipsized(
			page,
			'[data-testid="team-card-list"] p.truncate.font-medium',
		);
	});

	test('the top bar holds at its WIDEST state, across all three bands', async ({
		page,
	}) => {
		// The state the app-shell fix is actually about, and the one no fixture
		// rendered until now: a user with two orgs AND a company, so both
		// switchers show their dropdown triggers rather than a short label or a
		// zero-state link. Those triggers are the widest elements in the bar.
		//
		// 800px first — it is the load-bearing band. The shell measured 926
		// against an 800px viewport (a 126px overhang) versus 22px at 375px,
		// because the wordmark and BOTH switchers render there beside a toggle
		// that is still `lg:hidden`. A phone-only check calls this a rounding
		// error.
		for (const width of [800, 375, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/app/volunteers');

			// Wait for the widest state to actually be ON SCREEN before measuring.
			// `header` alone resolves far too early and was the first version of
			// this test: both switchers return `null` while their query is loading
			// (`OrgSwitcher.tsx`, `CompanySwitcher.tsx`) and the account control is
			// gated on `mounted`, so the assertion was measuring toggle + mark +
			// theme + bell — the NARROWEST the bar ever is, in a test named for the
			// widest.
			const header = page.locator('header');
			await expect(
				header.getByRole('button', { name: /Select org|Riverside/ }),
			).toBeVisible();
			await expect(
				header.getByRole('button', { name: /Select company|Sponsoring/ }),
			).toBeVisible();
			// NOT the account email: it is `hidden sm:inline`, so it is legitimately
			// absent at 375px. The two switcher triggers are the right hydration
			// proof — both are rendered from resolved tRPC queries, so their
			// presence means the client is live and the cluster is at full width.

			await expectNoHorizontalOverflow(page, width);
		}

		// The wordmark's `sm` gate, asserted DIRECTLY. The overflow checks above
		// cannot see it: measured, dropping the gate adds ~103px at 375px and the
		// switchers simply absorb it by truncating harder, so the document still
		// fits and every assertion stays green while the bar is visibly crowded.
		//
		// A width-of-the-account-control assertion was written here too and then
		// removed: measured with and without `shrink-0` on the right cluster, the
		// control is 240px either way at 800px. That utility is a statement of
		// intent, not a load-bearing fix, and a test asserting otherwise would
		// have been the third vacuous layout assertion in this ship. Recorded as
		// a P3 rather than pinned by a test that proves nothing.
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/volunteers');
		await expect(page.getByText('VolunteerReady')).toBeHidden();

		await page.setViewportSize({ width: 800, height: 900 });
		await page.goto('/app/volunteers');
		await expect(page.getByText('VolunteerReady')).toBeVisible();
	});

	test('at desktop width the TABLE is what renders, on all four', async ({
		page,
	}) => {
		// The other half of the switch, and until this existed nothing asserted
		// it: every other assertion runs below `lg` and checks the table is
		// hidden. Drop `lg:hidden` from a card-list wrapper and the whole suite
		// stayed green while a desktop user rendered BOTH trees — duplicated
		// rows, and two reachable Remove/Publish buttons per record, which is the
		// exact opposite of the "exactly one control per row is ever reachable"
		// claim every one of these files makes in a comment.
		await page.setViewportSize({ width: 1280, height: 900 });

		for (const [path, cardList, table] of [
			['/app/applications', 'applications-card-list', 'applications-table'],
			['/app/opportunities', 'opportunities-card-list', 'opportunities-table'],
			['/app/shifts', 'shifts-card-list', 'shifts-table'],
			['/app/settings/team', 'team-card-list', 'team-table'],
			// The reference implementation itself. `staff-created-volunteers.spec.ts`
			// asserts its table is hidden below `lg` but never that its CARD list is
			// hidden above — so the roster was the one table where dropping
			// `lg:hidden` still reddened nothing.
			['/app/volunteers', 'roster-card-list', 'roster-table'],
		] as const) {
			await page.goto(path);
			await page.getByTestId(table).waitFor();
			await expect(page.getByTestId(table)).toBeVisible();
			await expect(page.getByTestId(cardList)).toBeHidden();
		}
	});

	test('every one of the four still fits in the 768-1023px band', async ({
		page,
	}) => {
		// The band where the app shell's overflow was WORST (926 against an 800px
		// viewport, versus 22px at 375px) because the wordmark and both switchers
		// all render here beside a toggle that is still `lg:hidden`. Anyone
		// checking the shell fix on a phone alone would call it a rounding error.
		//
		// It is also the band where these pages are still on the CARD tree while
		// the viewport is nearly desktop-wide, so a card that assumed ~375px has
		// room to misbehave differently.
		await page.setViewportSize({ width: 800, height: 900 });

		for (const [path, testid] of [
			['/app/applications', 'applications-card-list'],
			['/app/opportunities', 'opportunities-card-list'],
			['/app/shifts', 'shifts-card-list'],
			['/app/settings/team', 'team-card-list'],
		] as const) {
			await page.goto(path);
			await page.getByTestId(testid).waitFor();
			await expect(page.getByTestId(testid.replace('-card-list', '-table'))).toBeHidden();
			await expectNoHorizontalOverflow(page, 800);
		}
	});
});
