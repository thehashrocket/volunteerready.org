import {
	CATALOG_VERSION,
	PLATFORM_ORG_NAME,
	PLATFORM_ORG_SLUG,
	SKILL_CATALOG,
} from '@/server/domain/reference-data';
import { prisma } from '@/server/repositories/prisma';

const META_KEY = 'catalog_version';

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

/** Seed the full skill catalog in a single transaction. Returns family + skill counts. */
export async function seedCatalog(): Promise<{
	families: number;
	skills: number;
}> {
	let familyCount = 0;
	let skillCount = 0;

	await prisma.$transaction(async (tx) => {
		for (const familyDef of SKILL_CATALOG) {
			const family = await tx.skillFamily.upsert({
				where: { slug: familyDef.slug },
				update: { name: familyDef.name },
				create: { name: familyDef.name, slug: familyDef.slug },
				select: { id: true },
			});
			familyCount++;

			for (const skillDef of familyDef.skills) {
				await tx.skill.upsert({
					where: { slug: skillDef.slug },
					update: { name: skillDef.name, familyId: family.id },
					create: {
						name: skillDef.name,
						slug: skillDef.slug,
						familyId: family.id,
					},
				});
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

/** Seed the platform org if it doesn't exist. */
export async function seedPlatformOrg(): Promise<void> {
	await prisma.organization.upsert({
		where: { slug: PLATFORM_ORG_SLUG },
		update: { name: PLATFORM_ORG_NAME },
		create: { name: PLATFORM_ORG_NAME, slug: PLATFORM_ORG_SLUG },
	});
}
