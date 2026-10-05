/**
 * Integration coverage for the platform org's template screener questions.
 *
 * Production ran from v0.22.0.0 with no template rows: the platform org's
 * questions predated the `isTemplate` column and defaulted to false. Signup
 * copies the templates into each new org, so new orgs got no questions, and
 * the boot guard's insert collided on `(orgId, key)` on every cold start.
 * Mocked tests could not see either. These recreate that state against
 * Postgres and check the migration and the boot guard's seed each repair it.
 *
 * This file rewrites the shared dev database's platform-org questions, so it
 * refuses any non-local host (even with INTEGRATION_ALLOW_REMOTE_DB) and must
 * not run while a dev server or e2e run uses the same database: their boot
 * guard would repair the rows mid-test.
 */

import { createHash } from 'node:crypto';
import {
	existsSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { Prisma } from '@/prisma/generated/client';
import {
	PLATFORM_ORG_NAME,
	PLATFORM_ORG_SLUG,
} from '@/server/domain/reference-data';
import {
	DEFAULT_SCREENER_QUESTION_KEYS,
	DEFAULT_SCREENER_QUESTIONS,
} from '@/server/domain/volunteer-screening';
import {
	findCurrentSlugByHistory,
	findOrgAcceptingApplications,
} from '@/server/repositories/orgRepo';
import {
	getTemplateQuestionById,
	getTemplateQuestionByKey,
	listTemplateQuestions,
} from '@/server/repositories/platformCatalogRepo';
import { prisma } from '@/server/repositories/prisma';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import { listPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';
import {
	areTemplateQuestionsSeeded,
	seedPlatformTemplateQuestions,
} from '@/server/repositories/referenceDataRepo';
import { seedDefaultQuestions } from '@/server/repositories/screenerQuestionsRepo';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';

const PREFIX = 'platform-templates-integ-';
const MIGRATION_SQL = readFileSync(
	path.resolve(
		'prisma/migrations/20261004120000_mark_platform_questions_as_templates/migration.sql',
	),
	'utf8',
);

let platformOrgId: string;
let createdPlatformOrg = false;
const orgIds: string[] = [];

// The deploy-time seed (`pnpm db:seed` in every production build) runs its own
// copy of this repair. prisma/seed-helpers.ts loads dotenv and opens its own
// client on import; dotenv never overwrites a variable that is already set and
// the integration setup has already refused a non-local DATABASE_URL, but the
// host is checked again here before every import, which goes through this one
// function. The client it opens is closed in the deploy-seed block's afterAll.
let seedHelpersModule: typeof import('../../../prisma/seed-helpers') | null =
	null;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
function assertLocalDatabase() {
	const host = new URL(process.env.DATABASE_URL ?? '').hostname;
	if (!LOCAL_HOSTS.includes(host)) {
		throw new Error(
			`platformTemplateQuestions.integration.test.ts rewrites the platform org's questions and only runs against a local database, not ${host}`,
		);
	}
}
async function loadSeedHelpers() {
	assertLocalDatabase();
	seedHelpersModule ??= await import('../../../prisma/seed-helpers');
	return seedHelpersModule;
}
// The shared dev database's platform questions, put back exactly afterwards:
// these tests delete, unmark and edit them.
let platformSnapshot: SnapshotRow[] | null = null;

/** The state production was in: platform questions present, none a template. */
async function recreatePreTemplateState() {
	// Active too, so a template deactivated in the dev catalog editor cannot
	// make signup's count differ from the template count.
	await prisma.screenerQuestion.updateMany({
		where: {
			orgId: platformOrgId,
			key: { in: DEFAULT_SCREENER_QUESTION_KEYS },
		},
		data: { isTemplate: false, isActive: true },
	});
	await prisma.screenerQuestion.createMany({
		data: DEFAULT_SCREENER_QUESTIONS.map((q) => ({
			orgId: platformOrgId,
			key: q.key,
			prompt: q.prompt,
			type: q.type,
			order: q.order,
			isActive: true,
			isTemplate: false,
			configJson: q.configJson as Prisma.InputJsonValue,
		})),
		skipDuplicates: true,
	});
}

/** Templates among the default keys: the rows this file unmarks and repairs.
 * Templates added in the catalog editor are left alone and not counted. */
async function platformTemplateCount() {
	return prisma.screenerQuestion.count({
		where: {
			orgId: platformOrgId,
			isTemplate: true,
			key: { in: DEFAULT_SCREENER_QUESTION_KEYS },
		},
	});
}

async function unmarkedPlatformCount() {
	return prisma.screenerQuestion.count({
		where: {
			orgId: platformOrgId,
			isTemplate: false,
			key: { in: DEFAULT_SCREENER_QUESTION_KEYS },
		},
	});
}

/** A tenant org holding a question flagged as a template, which never counts. */
async function createStrayTemplate(suffix: string) {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
	orgIds.push(org.id);
	return prisma.screenerQuestion.create({
		data: {
			orgId: org.id,
			key: `${PREFIX}stray_${suffix}`,
			prompt: 'Not a platform template',
			type: DEFAULT_SCREENER_QUESTIONS[0].type,
			order: 99,
			isActive: true,
			isTemplate: true,
			configJson: DEFAULT_SCREENER_QUESTIONS[0]
				.configJson as Prisma.InputJsonValue,
		},
	});
}

/** Default-key questions a new org gets at signup. Templates added in the
 * catalog editor are copied too but not counted, so a dev database that has
 * some does not change the answer. */
async function questionCountForNewOrg() {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}org`, slug: `${PREFIX}${orgIds.length}` },
	});
	orgIds.push(org.id);
	await seedDefaultQuestions(org.id);
	return prisma.screenerQuestion.count({
		where: { orgId: org.id, key: { in: DEFAULT_SCREENER_QUESTION_KEYS } },
	});
}

// The snapshot is also written to disk before any change, so a run killed
// mid-suite is undone by the next run instead of being snapshotted as-is.
/** Keyed to this database and platform org, so a file left by a killed run
 * against another database (or one since rebuilt) is never restored here. */
function snapshotFileFor(orgId: string) {
	const key = createHash('sha256')
		.update(`${process.env.DATABASE_URL ?? ''}|${orgId}`)
		.digest('hex')
		.slice(0, 16);
	return path.join(os.tmpdir(), `${PREFIX}${key}.json`);
}
let snapshotFile = '';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SnapshotRow = Omit<
	Prisma.ScreenerQuestionCreateManyInput,
	'disqualifierJson'
> & { disqualifierJson: Prisma.InputJsonValue | null };

async function restorePlatformQuestions(rows: SnapshotRow[]) {
	await prisma.$transaction([
		prisma.screenerQuestion.deleteMany({ where: { orgId: platformOrgId } }),
		prisma.screenerQuestion.createMany({
			data: rows.map((row) => ({
				...row,
				disqualifierJson: row.disqualifierJson ?? Prisma.DbNull,
			})),
		}),
	]);
}

beforeAll(async () => {
	assertLocalDatabase();
	// Self-heal after an interrupted run; this prefix is unique to this file.
	await prisma.volunteerApplication.deleteMany({
		where: { submittedByEmail: { startsWith: PREFIX } },
	});
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});

	const existing = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	if (existing) {
		platformOrgId = existing.id;
		snapshotFile = snapshotFileFor(platformOrgId);
		if (existsSync(snapshotFile)) {
			try {
				let rows: unknown = null;
				try {
					rows = JSON.parse(readFileSync(snapshotFile, 'utf8'));
				} catch {
					// Unreadable or truncated (a run killed while writing it): unusable.
				}
				const usable =
					Array.isArray(rows) &&
					rows.every((row: SnapshotRow) => row?.orgId === platformOrgId);
				// The file exists only while a run is in progress, so finding one
				// means a run was killed: restore it, whatever the rows look like
				// now (a dev server's boot guard may have repaired them since). A
				// file older than a day is stale, and restoring it would undo edits
				// made since, so it is dropped instead.
				const fresh =
					Date.now() - statSync(snapshotFile).mtimeMs < SNAPSHOT_MAX_AGE_MS;
				if (usable && fresh) {
					await restorePlatformQuestions(rows as SnapshotRow[]);
				} else if (usable) {
					console.warn(
						`[platformTemplateQuestions] Dropped a snapshot older than a day: ${snapshotFile}`,
					);
				}
			} finally {
				// Used once or discarded: a file that cannot be restored must not
				// fail every later run.
				rmSync(snapshotFile, { force: true });
			}
		}
		// An older interrupted run (before the snapshot file existed) can have
		// left a test prompt on a shared template, which every new dev org would
		// then copy.
		for (const q of DEFAULT_SCREENER_QUESTIONS) {
			await prisma.screenerQuestion.updateMany({
				where: {
					orgId: platformOrgId,
					key: q.key,
					prompt: { startsWith: PREFIX },
				},
				data: { prompt: q.prompt },
			});
		}
		const rows = await prisma.screenerQuestion.findMany({
			where: { orgId: platformOrgId },
		});
		platformSnapshot = rows.map((row) => ({
			...row,
			configJson: row.configJson as Prisma.InputJsonValue,
			disqualifierJson: row.disqualifierJson as Prisma.InputJsonValue | null,
		}));
		writeFileSync(snapshotFile, JSON.stringify(platformSnapshot), {
			mode: 0o600,
		});
	} else {
		const org = await prisma.organization.create({
			data: { name: PLATFORM_ORG_NAME, slug: PLATFORM_ORG_SLUG },
		});
		platformOrgId = org.id;
		createdPlatformOrg = true;
	}
});

beforeEach(recreatePreTemplateState);

afterAll(async () => {
	// The platform rows first: a failure in the rest of the cleanup must not
	// leave the dev database's signup templates unmarked.
	try {
		if (platformSnapshot) {
			// Only restore a snapshot this run actually took: if beforeAll failed
			// before taking it, restoring nothing would delete every platform
			// question.
			await restorePlatformQuestions(platformSnapshot);
			rmSync(snapshotFile, { force: true });
		}
	} finally {
		// Only a regressed submit guard writes one of these.
		await prisma.volunteerApplication.deleteMany({
			where: { submittedByEmail: { startsWith: PREFIX } },
		});
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: { in: orgIds } },
		});
		await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
		if (createdPlatformOrg) {
			await prisma.screenerQuestion.deleteMany({
				where: { orgId: platformOrgId },
			});
			await prisma.organization.delete({ where: { id: platformOrgId } });
		}
	}
});

describe('platform template questions', () => {
	it('gives a new org no questions while the platform rows are not templates', async () => {
		expect(await platformTemplateCount()).toBe(0);
		expect(await questionCountForNewOrg()).toBe(0);
	});

	it('the migration marks every default platform question as a template', async () => {
		await prisma.$executeRawUnsafe(MIGRATION_SQL);

		expect(await unmarkedPlatformCount()).toBe(0);
		expect(await questionCountForNewOrg()).toBeGreaterThanOrEqual(
			DEFAULT_SCREENER_QUESTIONS.length,
		);
	});

	it('the migration is safe to run twice', async () => {
		await prisma.$executeRawUnsafe(MIGRATION_SQL);
		const once = await platformTemplateCount();
		await prisma.$executeRawUnsafe(MIGRATION_SQL);

		expect(await platformTemplateCount()).toBe(once);
	});

	it('the boot guard seed repairs the rows instead of colliding with them', async () => {
		const result = await seedPlatformTemplateQuestions();

		expect(result.created).toBe(0);
		expect(result.repaired).toBe(DEFAULT_SCREENER_QUESTIONS.length);
		expect(await unmarkedPlatformCount()).toBe(0);
		expect(await questionCountForNewOrg()).toBeGreaterThanOrEqual(
			DEFAULT_SCREENER_QUESTIONS.length,
		);
	});

	// Value: protects=two cold starts inserting the same missing templates at
	// once both succeed; fails_when=skipDuplicates is dropped (the second insert
	// hits the (orgId, key) unique; Promise.all does not force the two
	// transactions to interleave, so this cannot prove the absence of a
	// find-then-create race); why_new=the other tests insert nothing
	// concurrently; seam=none
	it('two boot guards inserting the same missing templates at once both succeed', async () => {
		const missingKeys = DEFAULT_SCREENER_QUESTIONS.slice(0, 2).map(
			(q) => q.key,
		);
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: platformOrgId, key: { in: missingKeys } },
		});

		const results = await Promise.all([
			seedPlatformTemplateQuestions(),
			seedPlatformTemplateQuestions(),
		]);

		expect(results[0].created + results[1].created).toBe(missingKeys.length);
		expect(
			await prisma.screenerQuestion.count({
				where: {
					orgId: platformOrgId,
					key: { in: missingKeys },
					isTemplate: true,
				},
			}),
		).toBe(missingKeys.length);
	});

	// Generated by /ship coverage audit.
	// Value: protects=a missing default question is inserted as a template;
	// fails_when=createMany drops isTemplate:true or skipDuplicates swallows a
	// real insert; why_new=every test above starts with all rows present, so
	// created is always 0; seam=none
	it('the boot guard seed inserts a missing default question as a template', async () => {
		const missing = DEFAULT_SCREENER_QUESTIONS[0];
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: platformOrgId, key: missing.key },
		});

		const result = await seedPlatformTemplateQuestions();

		expect(result.created).toBe(1);
		const row = await prisma.screenerQuestion.findUnique({
			where: { orgId_key: { orgId: platformOrgId, key: missing.key } },
			select: { isTemplate: true, isActive: true },
		});
		expect(row).toEqual({ isTemplate: true, isActive: true });
	});

	// Generated by /ship coverage audit.
	// Value: protects=the seed and migration never overwrite an admin's edit
	// to a template prompt; fails_when=the seed becomes an upsert or the
	// migration sets more than isTemplate; why_new=no test edits a row; seam=none
	it('repairing a row keeps the admin-edited prompt', async () => {
		const edited = DEFAULT_SCREENER_QUESTIONS[0];
		const where = { orgId_key: { orgId: platformOrgId, key: edited.key } };
		const before = await prisma.screenerQuestion.findUniqueOrThrow({
			where,
			select: { prompt: true },
		});
		await prisma.screenerQuestion.update({
			where,
			data: { prompt: `${PREFIX}edited prompt` },
		});
		try {
			await prisma.$executeRawUnsafe(MIGRATION_SQL);
			await seedPlatformTemplateQuestions();

			const row = await prisma.screenerQuestion.findUniqueOrThrow({
				where,
				select: { prompt: true, isTemplate: true },
			});
			expect(row).toEqual({
				prompt: `${PREFIX}edited prompt`,
				isTemplate: true,
			});
		} finally {
			await prisma.screenerQuestion.update({
				where,
				data: { prompt: before.prompt },
			});
		}
	});

	// Generated by /ship coverage audit.
	// Value: protects=only platform-org questions become templates, so signup
	// never copies one tenant's questions into another; fails_when=the orgId
	// filter is dropped from the seed's updateMany or the migration's WHERE;
	// why_new=no test has a non-platform question present; seam=none
	it('the migration and the seed leave other orgs’ questions alone', async () => {
		const org = await prisma.organization.create({
			data: { name: `${PREFIX}tenant`, slug: `${PREFIX}tenant` },
		});
		orgIds.push(org.id);
		const foreign = await prisma.screenerQuestion.create({
			data: {
				orgId: org.id,
				key: `${PREFIX}tenant_question`,
				prompt: 'Tenant-only question',
				type: DEFAULT_SCREENER_QUESTIONS[0].type,
				order: 99,
				isActive: true,
				isTemplate: false,
				configJson: DEFAULT_SCREENER_QUESTIONS[0]
					.configJson as Prisma.InputJsonValue,
			},
		});

		await prisma.$executeRawUnsafe(MIGRATION_SQL);
		await recreatePreTemplateState();
		await seedPlatformTemplateQuestions();

		const row = await prisma.screenerQuestion.findUniqueOrThrow({
			where: { id: foreign.id },
			select: { isTemplate: true },
		});
		expect(row.isTemplate).toBe(false);
	});

	// Value: protects=a new org gets only the platform org's templates;
	// fails_when=seedDefaultQuestions stops filtering on the platform org, so a
	// template flag on any other org's row is copied into every signup;
	// why_new=the other signup checks have no template row outside the platform
	// org; seam=none
	it('signup copies only the platform org’s templates', async () => {
		await prisma.$executeRawUnsafe(MIGRATION_SQL);
		const other = await prisma.organization.create({
			data: { name: `${PREFIX}other`, slug: `${PREFIX}other` },
		});
		orgIds.push(other.id);
		await prisma.screenerQuestion.create({
			data: {
				orgId: other.id,
				key: `${PREFIX}stray_template`,
				prompt: 'Not a platform template',
				type: DEFAULT_SCREENER_QUESTIONS[0].type,
				order: 99,
				isActive: true,
				isTemplate: true,
				configJson: DEFAULT_SCREENER_QUESTIONS[0]
					.configJson as Prisma.InputJsonValue,
			},
		});

		const org = await prisma.organization.create({
			data: { name: `${PREFIX}org`, slug: `${PREFIX}signup` },
		});
		orgIds.push(org.id);
		const copied = await seedDefaultQuestions(org.id);

		const keys = await prisma.screenerQuestion.findMany({
			where: { orgId: org.id },
			select: { key: true },
		});
		expect(keys.map((k) => k.key)).not.toContain(`${PREFIX}stray_template`);
		const defaultKeys = keys.filter((k) =>
			DEFAULT_SCREENER_QUESTION_KEYS.includes(k.key),
		);
		expect(defaultKeys.length).toBe(await platformTemplateCount());
		// Generated by /ship coverage audit. createOrg reports a 0 return to
		// Sentry, so the count must be the rows actually copied.
		expect(copied).toBe(keys.length);
	});
});

describe('only the default questions are ever promoted', () => {
	// Value: protects=a non-default question on the platform org never becomes
	// every new org's question; fails_when=the migration, the boot-guard seed or
	// the deploy seed drops its default-key filter, or the guard's health check
	// counts non-default rows; why_new=the other tests only have default keys
	// on the platform org; seam=none
	it('leaves a non-default platform question unmarked and out of signup', async () => {
		const stray = await prisma.screenerQuestion.create({
			data: {
				orgId: platformOrgId,
				key: `${PREFIX}not_a_default`,
				prompt: 'Not a default question',
				type: DEFAULT_SCREENER_QUESTIONS[0].type,
				order: 98,
				isActive: true,
				isTemplate: false,
				configJson: DEFAULT_SCREENER_QUESTIONS[0]
					.configJson as Prisma.InputJsonValue,
			},
		});
		try {
			await prisma.$executeRawUnsafe(MIGRATION_SQL);
			await seedPlatformTemplateQuestions();
			const seedHelpers = await loadSeedHelpers();
			await seedHelpers.seedPlatformTemplateQuestions();

			const row = await prisma.screenerQuestion.findUniqueOrThrow({
				where: { id: stray.id },
				select: { isTemplate: true },
			});
			expect(row.isTemplate).toBe(false);
			expect(await areTemplateQuestionsSeeded()).toBe(true);
		} finally {
			await prisma.screenerQuestion.delete({ where: { id: stray.id } });
		}
	});

	it('the migration names exactly the default keys', () => {
		const listed = [...MIGRATION_SQL.matchAll(/'([a-z0-9-]+)'/g)]
			.map((m) => m[1])
			.filter((value) => value !== PLATFORM_ORG_SLUG);
		expect(listed.sort()).toEqual([...DEFAULT_SCREENER_QUESTION_KEYS].sort());
	});
});

describe('one definition of a template', () => {
	// Value: protects=the boot guard repairs a partly marked platform org;
	// fails_when=areTemplateQuestionsSeeded goes back to "any template row
	// exists", so one marked row hides the rest from signup; why_new=the repo
	// tests call the seed directly and never the guard's check; seam=none
	it('the boot guard check is false while any default platform question is unmarked', async () => {
		await prisma.screenerQuestion.updateMany({
			where: { orgId: platformOrgId, key: DEFAULT_SCREENER_QUESTIONS[0].key },
			data: { isTemplate: true },
		});

		expect(await areTemplateQuestionsSeeded()).toBe(false);

		await seedPlatformTemplateQuestions();
		expect(await areTemplateQuestionsSeeded()).toBe(true);
	});

	// Value: protects=the boot guard recreates a default template that is
	// missing, so signups keep the full default set; fails_when=the check
	// passes on "some template exists" without every default key; why_new=both
	// adversarial reviews found the gap; seam=none
	it('the boot guard check is false while a default template is missing, and the repair recreates it', async () => {
		await seedPlatformTemplateQuestions();
		expect(await areTemplateQuestionsSeeded()).toBe(true);
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: platformOrgId, key: DEFAULT_SCREENER_QUESTIONS[1].key },
		});

		expect(await areTemplateQuestionsSeeded()).toBe(false);

		const result = await seedPlatformTemplateQuestions();
		expect(result.created).toBe(1);
		expect(await areTemplateQuestionsSeeded()).toBe(true);
		expect(await questionCountForNewOrg()).toBe(
			DEFAULT_SCREENER_QUESTIONS.length,
		);
	});

	// Value: protects=a stray template flag on a tenant's row cannot satisfy the
	// boot guard; fails_when=the check stops filtering on the platform org;
	// why_new=no other test has a tenant template while platform rows are
	// unmarked; seam=none
	it('a tenant row flagged as a template does not satisfy the boot guard check', async () => {
		// No platform questions at all, so only the tenant row could count.
		// beforeEach recreates them for the next test.
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: platformOrgId },
		});
		await createStrayTemplate('gate');

		expect(await areTemplateQuestionsSeeded()).toBe(false);
	});

	// Value: protects=the platform admin catalog editor only lists and finds
	// platform templates; fails_when=listTemplateQuestions or
	// getTemplateQuestionByKey drop the platform-org filter, so the editor
	// shows or edits a tenant's row; why_new=no test covers the editor's
	// lookups against real rows; seam=none
	it('the catalog editor never lists or finds a tenant row', async () => {
		await prisma.$executeRawUnsafe(MIGRATION_SQL);
		const stray = await createStrayTemplate('editor');

		const listed = await listTemplateQuestions();
		expect(listed.map((q) => q.id)).not.toContain(stray.id);
		expect(listed.every((q) => q.orgId === platformOrgId)).toBe(true);
		expect(await getTemplateQuestionByKey(stray.key)).toBeNull();
		// Generated by /ship coverage audit. updateTemplateQuestion looks rows
		// up by id, so an unscoped lookup would let the editor edit a tenant row.
		expect(await getTemplateQuestionById(stray.id)).toBeNull();
	});
});

describe('the platform org is not a public org', () => {
	// Value: protects=no one can submit an application to the platform org,
	// which has no members to read it; fails_when=submitVolunteerApplication
	// loses its platform-org guard (both screener.submit and the by-slug path
	// route through it); why_new=no test submits to the platform org; seam=none
	it('refuses an application submitted to the platform org', async () => {
		const before = await prisma.volunteerApplication.count({
			where: { orgId: platformOrgId },
		});

		await expect(
			submitVolunteerApplication(platformOrgId, {
				submittedByEmail: `${PREFIX}applicant@example.test`,
				profile: {},
				responses: [],
			} as unknown as Parameters<typeof submitVolunteerApplication>[1]),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(
			await prisma.volunteerApplication.count({
				where: { orgId: platformOrgId },
			}),
		).toBe(before);
	});

	// Value: protects=/apply/platform and /opportunities/platform resolve to
	// not-found; fails_when=either public read path stops excluding the
	// platform slug; why_new=no test reads the platform org publicly; seam=none
	it('has no public apply form or opportunity listing', async () => {
		expect((await getPublicFormByOrgSlug(PLATFORM_ORG_SLUG)).org).toBeNull();
		expect(await listPublishedOpportunities(PLATFORM_ORG_SLUG)).toBeNull();
	});

	// Value: protects=/apply/platform and /opportunities/platform never
	// redirect into another org; fails_when=findCurrentSlugByHistory stops
	// ignoring the platform slug, so a stale OrgSlugHistory row with
	// oldSlug='platform' sends public applicants to that org; why_new=no test
	// has a history row for the platform slug; seam=none
	it('never redirects the platform slug through slug history', async () => {
		const other = await prisma.organization.create({
			data: { name: `${PREFIX}renamed`, slug: `${PREFIX}renamed` },
		});
		orgIds.push(other.id);
		await prisma.orgSlugHistory.createMany({
			data: [
				{ orgId: other.id, oldSlug: PLATFORM_ORG_SLUG },
				{ orgId: other.id, oldSlug: `${PREFIX}old-name` },
			],
		});
		try {
			expect(await findCurrentSlugByHistory(PLATFORM_ORG_SLUG)).toBeNull();
			expect(await findCurrentSlugByHistory(`${PREFIX}old-name`)).toBe(
				other.slug,
			);
		} finally {
			await prisma.orgSlugHistory.deleteMany({ where: { orgId: other.id } });
		}
	});

	// Value: protects=sitemap.xml never advertises the platform org's
	// not-found pages; fails_when=the sitemap query drops its platform
	// exclusion; why_new=no test reads the sitemap; seam=none
	it('leaves the platform org out of the sitemap', async () => {
		const urls = (await sitemap()).map((entry) => entry.url);

		expect(
			urls.some((url) => url.endsWith(`/apply/${PLATFORM_ORG_SLUG}`)),
		).toBe(false);
		expect(
			urls.some((url) => url.endsWith(`/opportunities/${PLATFORM_ORG_SLUG}`)),
		).toBe(false);
	});

	it('accepts applications for a real org only', async () => {
		const other = await prisma.organization.create({
			data: { name: `${PREFIX}public`, slug: `${PREFIX}public` },
		});
		orgIds.push(other.id);

		expect(await findOrgAcceptingApplications(platformOrgId)).toBeNull();
		expect(
			await findOrgAcceptingApplications(`${PREFIX}no-such-org`),
		).toBeNull();
		expect(await findOrgAcceptingApplications(other.id)).toEqual({
			marketplaceVisible: false,
		});
		expect((await getPublicFormByOrgSlug(other.slug)).org?.id).toBe(other.id);
	});
});

// Imports go through loadSeedHelpers() (top of file), which checks the host.
describe('deploy-time seed (prisma/seed-helpers.ts)', () => {
	let seedHelpers: typeof import('../../../prisma/seed-helpers');

	beforeAll(async () => {
		seedHelpers = await loadSeedHelpers();
	});

	afterAll(async () => {
		await seedHelpersModule?.prisma.$disconnect();
	});

	// Value: protects=every deploy's seed marks the platform questions as
	// templates; fails_when=the seed helper's updateMany is removed or loses its
	// platform-org scope; why_new=the tests above exercise the app's repo
	// function, not this separate deploy-time copy; seam=none
	it('marks the existing platform questions as templates', async () => {
		await seedHelpers.seedPlatformTemplateQuestions();

		expect(await unmarkedPlatformCount()).toBe(0);
		expect(await questionCountForNewOrg()).toBeGreaterThanOrEqual(
			DEFAULT_SCREENER_QUESTIONS.length,
		);
	});

	// Value: protects=the deploy-time seed inserts a missing default as a
	// template; fails_when=its createMany drops isTemplate:true or stops
	// inserting; why_new=no other test runs the seed helper's insert; seam=none
	it('inserts a missing default question as a template', async () => {
		const missing = DEFAULT_SCREENER_QUESTIONS[0];
		await prisma.screenerQuestion.deleteMany({
			where: { orgId: platformOrgId, key: missing.key },
		});

		await seedHelpers.seedPlatformTemplateQuestions();

		const row = await prisma.screenerQuestion.findUnique({
			where: { orgId_key: { orgId: platformOrgId, key: missing.key } },
			select: { isTemplate: true, isActive: true },
		});
		expect(row).toEqual({ isTemplate: true, isActive: true });
	});
});
