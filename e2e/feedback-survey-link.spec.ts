/**
 * The org feedback survey email links to /screening/feedback/start, which
 * moves the token into an httpOnly cookie and redirects to the token-free
 * survey URL. Checks the redirect, that the token is nowhere in the page or
 * any off-site request, and that a reload keeps the survey open. Cookies,
 * redirects and hydration are only real in a browser against the dev server.
 *
 * Read-only against the database: it signs a link for the seeded
 * `helping-hands` org (`pnpm seed:dev`) and writes nothing.
 */
import { expect, test } from '@playwright/test';
import { INVALID_SURVEY_LINK_ERROR } from '../src/server/domain/org-feedback';
import { generateOrgFeedbackToken } from '../src/server/lib/org-feedback-token';
import { disconnectPrisma, getPrisma } from './utils/db';

// Reads the .env.local database and secret, which a remote target would not
// share.
const REMOTE_TARGET =
	!!process.env.PLAYWRIGHT_BASE_URL &&
	!/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL);
test.skip(
	REMOTE_TARGET,
	'feedback-survey-link.spec.ts signs a link with the local secret — remote targets unsupported',
);

const ORG_SLUG = 'helping-hands';
let token: string;

test.beforeAll(async () => {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
	const org = await getPrisma().organization.findUnique({
		where: { slug: ORG_SLUG },
		select: { id: true },
	});
	if (!org) throw new Error(`seeded org ${ORG_SLUG} not found — run pnpm seed:dev`);
	token = generateOrgFeedbackToken(secret, org.id, 'DAY_7');
});

test.afterAll(async () => {
	await disconnectPrisma();
});

test('survey link opens a token-free survey that survives a reload', async ({
	page,
	baseURL,
}) => {
	const pageErrors: string[] = [];
	page.on('pageerror', (err) => pageErrors.push(err.message));
	const offSiteUrls: string[] = [];
	page.on('request', (req) => {
		if (new URL(req.url()).origin !== new URL(baseURL ?? '').origin) {
			offSiteUrls.push(req.url());
		}
	});

	await page.goto(
		`/screening/feedback/start?org=${ORG_SLUG}&type=DAY_7&token=${token}`,
		{ waitUntil: 'load' },
	);

	const heading = page.getByRole('heading', { name: "How's your first week?" });
	await expect(heading).toBeVisible();
	const url = new URL(page.url());
	expect(url.pathname).toBe('/screening/feedback');
	expect(url.searchParams.get('token')).toBeNull();
	expect(url.searchParams.get('org')).toBe(ORG_SLUG);
	expect(await page.content()).not.toContain(token);
	await expect(page.locator('form input[name="token"]')).toHaveCount(0);

	await page.reload({ waitUntil: 'load' });
	await expect(heading).toBeVisible();

	expect(offSiteUrls.filter((u) => u.includes(token))).toEqual([]);
	expect(pageErrors).toEqual([]);
});

// Value: protects=a user's answers stay in the form when the server refuses
// them; fails_when=the form stops refilling from the action's returned
// answers; why_new=React resets a form after its action runs; seam=none
test('keeps typed answers when the server refuses the survey', async ({
	page,
	context,
}) => {
	await page.goto(
		`/screening/feedback/start?org=${ORG_SLUG}&type=DAY_7&token=${token}`,
		{ waitUntil: 'load' },
	);
	const answer = page.getByLabel("What's working well?");
	await answer.fill('Scheduling is easy');
	// The link stops being valid between loading the form and sending it.
	await context.clearCookies({
		name: `org-feedback-token-DAY_7-${ORG_SLUG}`,
	});

	await page.getByRole('button', { name: 'Submit feedback' }).click();

	await expect(page.getByText(INVALID_SURVEY_LINK_ERROR)).toBeVisible();
	await expect(answer).toHaveValue('Scheduling is easy');
});

test('the survey page without its cookie shows the invalid-link page', async ({
	page,
}) => {
	await page.goto(`/screening/feedback?org=${ORG_SLUG}&type=DAY_7`, {
		waitUntil: 'load',
	});

	await expect(
		page.getByRole('heading', { name: 'Invalid feedback link' }),
	).toBeVisible();
});
