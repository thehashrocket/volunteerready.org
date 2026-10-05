import type { Prisma } from '@/prisma/generated/client';
import {
	CATALOG_VERSION,
	PLATFORM_ORG_NAME,
	PLATFORM_ORG_SLUG,
	SKILL_CATALOG,
} from '@/server/domain/reference-data';
import {
	DEFAULT_SCREENER_QUESTION_KEYS,
	DEFAULT_SCREENER_QUESTIONS,
} from '@/server/domain/volunteer-screening';
import { prisma } from '@/server/repositories/prisma';

const META_KEY = 'catalog_version';

/**
 * A template is a question on the platform org with `isTemplate` set. Every
 * template reader matches both, so a stray flag on a tenant's row is never
 * treated as a template.
 */
export const PLATFORM_TEMPLATE_WHERE = {
	isTemplate: true,
	organization: { slug: PLATFORM_ORG_SLUG },
} satisfies Prisma.ScreenerQuestionWhereInput;

/** Check whether the skill catalog has been seeded and is up-to-date. */
export async function isCatalogSeeded(): Promise<boolean> {
	const [familyCount, meta] = await Promise.all([
		prisma.skillFamily.count(),
		prisma.referenceDataMeta.findUnique({ where: { key: META_KEY } }),
	]);

	if (familyCount === 0) return false;
	if (!meta) return false;

	const storedVersion = Number(meta.value);
	return storedVersion === CATALOG_VERSION;
}

/** Check whether the platform org exists. */
export async function isPlatformOrgSeeded(): Promise<boolean> {
	const org = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	return org !== null;
}

/**
 * Check whether the platform org's template questions are in place: every
 * default key present as a template. A default that is unmarked, deleted, or
 * newly added to DEFAULT_SCREENER_QUESTIONS still needs
 * seedPlatformTemplateQuestions' repair. Keys are unique per org, so one count
 * covers all three.
 */
export async function areTemplateQuestionsSeeded(): Promise<boolean> {
	const defaultTemplates = await prisma.screenerQuestion.count({
		where: {
			...PLATFORM_TEMPLATE_WHERE,
			key: { in: DEFAULT_SCREENER_QUESTION_KEYS },
		},
	});
	return defaultTemplates === DEFAULT_SCREENER_QUESTION_KEYS.length;
}

/**
 * Seed the skill catalog in a single transaction. Create-only semantics: new
 * families/skills from SKILL_CATALOG are added if missing, but existing rows
 * are never overwritten. This means admin edits via the catalog editor are
 * preserved across version bumps.
 */
export async function seedCatalog(): Promise<{
	families: number;
	skills: number;
}> {
	let familyCount = 0;
	let skillCount = 0;

	await prisma.$transaction(async (tx) => {
		for (const familyDef of SKILL_CATALOG) {
			const existing = await tx.skillFamily.findUnique({
				where: { slug: familyDef.slug },
				select: { id: true },
			});
			let familyId = existing?.id;
			if (!familyId) {
				const created = await tx.skillFamily.create({
					data: { name: familyDef.name, slug: familyDef.slug },
					select: { id: true },
				});
				familyId = created.id;
			}
			familyCount++;

			for (const skillDef of familyDef.skills) {
				const existingSkill = await tx.skill.findUnique({
					where: { slug: skillDef.slug },
					select: { id: true },
				});
				if (!existingSkill) {
					await tx.skill.create({
						data: {
							name: skillDef.name,
							slug: skillDef.slug,
							familyId,
						},
					});
				}
				skillCount++;
			}
		}

		await tx.referenceDataMeta.upsert({
			where: { key: META_KEY },
			update: { value: String(CATALOG_VERSION) },
			create: { key: META_KEY, value: String(CATALOG_VERSION) },
		});
	});

	return { families: familyCount, skills: skillCount };
}

/** Seed the platform org if it doesn't exist. Idempotent. */
export async function seedPlatformOrg(): Promise<void> {
	await prisma.organization.upsert({
		where: { slug: PLATFORM_ORG_SLUG },
		update: {},
		create: { name: PLATFORM_ORG_NAME, slug: PLATFORM_ORG_SLUG },
	});
}

/**
 * Seed DEFAULT_SCREENER_QUESTIONS into the platform org as template rows
 * (isTemplate=true). Create-only: an existing row (matched on the
 * `(orgId, key)` unique) is never overwritten, so admin edits via the catalog
 * editor are preserved. `ON CONFLICT DO NOTHING` also means two cold starts
 * seeding at once cannot collide.
 *
 * Signup copies the platform org's templates into each new org. The default
 * questions there predate the `isTemplate` column, which defaulted them to
 * false: that hid them from signup and made this seed's insert collide on
 * every boot. So any unmarked default (and only a default: see
 * DEFAULT_SCREENER_QUESTION_KEYS) is marked as a template here and reported as
 * `repaired`.
 */
export async function seedPlatformTemplateQuestions(): Promise<{
	created: number;
	repaired: number;
}> {
	const platformOrg = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	if (!platformOrg) {
		throw new Error(
			'Platform org must be seeded before template questions can be seeded.',
		);
	}

	return prisma.$transaction(async (tx) => {
		const repaired = await tx.screenerQuestion.updateMany({
			where: {
				orgId: platformOrg.id,
				isTemplate: false,
				key: { in: DEFAULT_SCREENER_QUESTION_KEYS },
			},
			data: { isTemplate: true },
		});
		const created = await tx.screenerQuestion.createMany({
			data: DEFAULT_SCREENER_QUESTIONS.map((q) => ({
				orgId: platformOrg.id,
				key: q.key,
				prompt: q.prompt,
				type: q.type,
				order: q.order,
				isActive: true,
				isTemplate: true,
				configJson: q.configJson as Prisma.InputJsonValue,
			})),
			skipDuplicates: true,
		});
		return { created: created.count, repaired: repaired.count };
	});
}
