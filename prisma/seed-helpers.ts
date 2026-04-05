import dotenv from 'dotenv';

// Match Next.js dotenv loading order: most specific wins (first loaded, never overwritten).
// See: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#environment-variable-load-order
const env = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${env}.local` });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: `.env.${env}` });
dotenv.config();

import crypto from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
	type ApplicationStatus,
	type AvailabilityType,
	type CredentialStatus,
	type CredentialType,
	type OpportunityStatus,
	type Prisma,
	PrismaClient,
	type ProfileVisibility,
	type RequirementLevel,
	Role,
	type ScreenerQuestionType,
	type ScreeningStatus,
	type ShareTokenStatus,
	type ShiftStatus,
	type SignupStatus,
} from '../src/prisma/generated/client/index.js';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) throw new Error('DATABASE_URL is not set');

export const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

// Re-export types used by seed files
export {
	type ApplicationStatus,
	type AvailabilityType,
	type CredentialStatus,
	type CredentialType,
	type OpportunityStatus,
	type Prisma,
	type ProfileVisibility,
	type RequirementLevel,
	Role,
	type ScreenerQuestionType,
	type ScreeningStatus,
	type ShareTokenStatus,
	type ShiftStatus,
	type SignupStatus,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic date helpers relative to "now" */
const NOW = new Date();
export function daysFromNow(n: number): Date {
	const d = new Date(NOW);
	d.setDate(d.getDate() + n);
	return d;
}
export function daysAgo(n: number): Date {
	return daysFromNow(-n);
}
export function hoursFromNow(n: number): Date {
	const d = new Date(NOW);
	d.setHours(d.getHours() + n);
	return d;
}

export type SeedQuestion = {
	key: string;
	prompt: string;
	type: ScreenerQuestionType;
	order: number;
	isActive: boolean;
	configJson: Record<string, unknown>;
};

export type SeedAppInput = {
	orgId: string;
	submittedByEmail: string;
	submittedByUserId?: string | null;
	opportunityId?: string | null;
	status: ApplicationStatus;
	screeningStatus: ScreeningStatus;
	screeningReasons: unknown;
	answers: Array<{ questionKey: string; value: unknown }>;
};

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

export async function upsertOrg(slug: string, name: string) {
	return prisma.organization.upsert({
		where: { slug },
		update: { name },
		create: { name, slug },
		select: { id: true, slug: true, name: true },
	});
}

export async function upsertUser(email: string, name: string, image?: string) {
	return prisma.user.upsert({
		where: { email },
		update: { name, image },
		create: { name, email, image },
		select: { id: true, email: true, name: true },
	});
}

export async function upsertMember(orgId: string, userId: string, role: Role) {
	return prisma.organizationMember.upsert({
		where: { organizationId_userId: { organizationId: orgId, userId } },
		update: { role },
		create: { organizationId: orgId, userId, role },
	});
}

export async function upsertProfile(
	userId: string,
	data: {
		bio?: string;
		phone?: string;
		city?: string;
		state?: string;
		country?: string;
		availability?: AvailabilityType;
		visibility?: ProfileVisibility;
		interests?: string[];
	},
) {
	return prisma.volunteerProfile.upsert({
		where: { userId },
		update: data,
		create: { userId, ...data },
	});
}

// ---------------------------------------------------------------------------
// Skill catalog (SkillFamily + Skill) — canonical data lives in domain layer.
// ---------------------------------------------------------------------------

export { SKILL_CATALOG } from '../src/server/domain/reference-data.js';

import {
	CATALOG_VERSION,
	SKILL_CATALOG,
} from '../src/server/domain/reference-data.js';

/** Seed skill catalog and return a slug->id lookup map for all skills and families. */
export async function seedSkillCatalog(): Promise<{
	skillBySlug: Map<string, string>;
	familyBySlug: Map<string, string>;
}> {
	const skillBySlug = new Map<string, string>();
	const familyBySlug = new Map<string, string>();

	for (const familyDef of SKILL_CATALOG) {
		const family = await prisma.skillFamily.upsert({
			where: { slug: familyDef.slug },
			update: { name: familyDef.name },
			create: { name: familyDef.name, slug: familyDef.slug },
			select: { id: true, slug: true },
		});
		familyBySlug.set(family.slug, family.id);

		for (const skillDef of familyDef.skills) {
			const skill = await prisma.skill.upsert({
				where: { slug: skillDef.slug },
				update: { name: skillDef.name, familyId: family.id },
				create: {
					name: skillDef.name,
					slug: skillDef.slug,
					familyId: family.id,
				},
				select: { id: true, slug: true },
			});
			skillBySlug.set(skill.slug, skill.id);
		}
	}

	// Write version meta so the runtime boot guard knows seeding is current
	await prisma.referenceDataMeta.upsert({
		where: { key: 'catalog_version' },
		update: { value: String(CATALOG_VERSION) },
		create: { key: 'catalog_version', value: String(CATALOG_VERSION) },
	});

	return { skillBySlug, familyBySlug };
}

// ---------------------------------------------------------------------------
// Default screener questions — backfill for pre-existing orgs.
// Idempotent via createMany + skipDuplicates (@@unique([orgId, key])).
// ---------------------------------------------------------------------------

import { DEFAULT_SCREENER_QUESTIONS } from '../src/server/domain/volunteer-screening.js';

export async function backfillDefaultQuestions() {
	const orgs = await prisma.organization.findMany({
		select: { id: true, name: true },
		orderBy: { createdAt: 'asc' },
	});

	let totalInserted = 0;
	let orgsUpdated = 0;

	for (const org of orgs) {
		const result = await prisma.screenerQuestion.createMany({
			data: DEFAULT_SCREENER_QUESTIONS.map((q) => ({
				orgId: org.id,
				key: q.key,
				prompt: q.prompt,
				type: q.type,
				order: q.order,
				isActive: true,
				configJson: q.configJson as Prisma.InputJsonValue,
			})),
			skipDuplicates: true,
		});

		if (result.count > 0) {
			totalInserted += result.count;
			orgsUpdated++;
			console.log(`   ${org.name}: inserted ${result.count} default questions`);
		}
	}

	console.log(
		`   ${totalInserted} questions across ${orgsUpdated} orgs (${orgs.length - orgsUpdated} already had all defaults)\n`,
	);
}

export async function upsertSkills(
	userId: string,
	skillSlugs: string[],
	skillBySlug: Map<string, string>,
) {
	for (const slug of skillSlugs) {
		const skillId = skillBySlug.get(slug);
		if (!skillId) {
			console.warn(`  Unknown skill slug: ${slug} — skipping`);
			continue;
		}
		await prisma.volunteerSkill.upsert({
			where: { userId_skillId: { userId, skillId } },
			update: {},
			create: { userId, skillId },
		});
	}
}

export async function upsertQuestions(
	orgId: string,
	questions: SeedQuestion[],
) {
	for (const q of questions) {
		await prisma.screenerQuestion.upsert({
			where: { orgId_key: { orgId, key: q.key } },
			update: {
				prompt: q.prompt,
				type: q.type,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as Prisma.InputJsonValue,
			},
			create: {
				orgId,
				key: q.key,
				prompt: q.prompt,
				type: q.type,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as Prisma.InputJsonValue,
			},
		});
	}
}

export async function upsertFeatureFlag(
	orgId: string,
	key: string,
	enabled: boolean,
) {
	return prisma.featureFlag.upsert({
		where: { orgId_key: { orgId, key } },
		update: { enabled },
		create: { orgId, key, enabled },
	});
}

export async function getQuestionsByKey(orgId: string, keys: string[]) {
	const questions = await prisma.screenerQuestion.findMany({
		where: { orgId, key: { in: keys } },
		select: { id: true, key: true },
	});
	const map = new Map(questions.map((q) => [q.key, q.id]));
	const missing = keys.filter((k) => !map.has(k));
	if (missing.length > 0) {
		throw new Error(
			`Missing screener questions for keys: ${missing.join(', ')}`,
		);
	}
	return map;
}

export async function createApplicationIfNotExists(input: SeedAppInput) {
	const existing = await prisma.volunteerApplication.findFirst({
		where: { orgId: input.orgId, submittedByEmail: input.submittedByEmail },
		select: { id: true },
	});
	if (existing) return existing;

	const questionKeys = input.answers.map((a) => a.questionKey);
	const qMap = await getQuestionsByKey(input.orgId, questionKeys);

	return prisma.volunteerApplication.create({
		data: {
			orgId: input.orgId,
			submittedByEmail: input.submittedByEmail,
			submittedByUserId: input.submittedByUserId ?? null,
			opportunityId: input.opportunityId ?? null,
			status: input.status,
			screeningStatus: input.screeningStatus,
			screeningReasons: input.screeningReasons as Prisma.InputJsonValue,
			submittedAt: new Date(),
			answers: {
				create: input.answers.map((a) => ({
					// biome-ignore lint/style/noNonNullAssertion: validated above
					questionId: qMap.get(a.questionKey)!,
					answerJson: a.value as Prisma.InputJsonValue,
				})),
			},
		},
		select: { id: true },
	});
}

export async function upsertCredential(
	userId: string,
	orgId: string,
	type: CredentialType,
	status: CredentialStatus,
	extra?: {
		issuedAt?: Date;
		expiresAt?: Date;
		notes?: string;
		sharedFromOrgId?: string;
		sharedFromCredentialId?: string;
	},
) {
	return prisma.volunteerCredential.upsert({
		where: { userId_orgId_type: { userId, orgId, type } },
		update: { status, ...extra },
		create: { userId, orgId, type, status, ...extra },
	});
}

export function seedTokenHash(label: string): string {
	return crypto
		.createHash('sha256')
		.update(`seed-token-${label}`)
		.digest('hex');
}

export async function createOpportunityIfNotExists(data: {
	orgId: string;
	title: string;
	description: string;
	status: OpportunityStatus;
	location?: string;
	isRemote?: boolean;
	startDate?: Date;
	endDate?: Date;
	commitmentHours?: number;
	capacity?: number;
	tags?: string[];
	requirements?: Array<{
		skillId?: string;
		familyId?: string;
		level: RequirementLevel;
	}>;
}) {
	const existing = await prisma.volunteerOpportunity.findFirst({
		where: { orgId: data.orgId, title: data.title },
		select: { id: true },
	});

	if (existing) {
		// Re-sync requirements (migration may have cleared them)
		if (data.requirements && data.requirements.length > 0) {
			await prisma.opportunityRequirement.deleteMany({
				where: { opportunityId: existing.id },
			});
			await prisma.opportunityRequirement.createMany({
				data: data.requirements.map((r) => ({
					opportunityId: existing.id,
					skillId: r.skillId ?? null,
					familyId: r.familyId ?? null,
					level: r.level,
				})),
			});
		}
		return existing;
	}

	return prisma.volunteerOpportunity.create({
		data: {
			orgId: data.orgId,
			title: data.title,
			description: data.description,
			status: data.status,
			location: data.location,
			isRemote: data.isRemote ?? false,
			startDate: data.startDate,
			endDate: data.endDate,
			commitmentHours: data.commitmentHours,
			capacity: data.capacity,
			tags: { create: (data.tags ?? []).map((name) => ({ name })) },
			requirements: {
				create: (data.requirements ?? []).map((r) => ({
					skillId: r.skillId ?? null,
					familyId: r.familyId ?? null,
					level: r.level,
				})),
			},
		},
		select: { id: true },
	});
}

export async function createShiftIfNotExists(data: {
	orgId: string;
	opportunityId?: string;
	title: string;
	description?: string;
	location?: string;
	isRemote?: boolean;
	startTime: Date;
	endTime: Date;
	capacity: number;
	status: ShiftStatus;
}) {
	const existing = await prisma.shift.findFirst({
		where: {
			orgId: data.orgId,
			title: data.title,
			startTime: data.startTime,
		},
		select: { id: true },
	});
	if (existing) return existing;
	return prisma.shift.create({
		data: {
			orgId: data.orgId,
			opportunityId: data.opportunityId,
			title: data.title,
			description: data.description,
			location: data.location,
			isRemote: data.isRemote ?? false,
			startTime: data.startTime,
			endTime: data.endTime,
			capacity: data.capacity,
			status: data.status,
		},
		select: { id: true },
	});
}

export async function createSignupIfNotExists(
	shiftId: string,
	userId: string,
	status: SignupStatus,
	notes?: string,
) {
	const existing = await prisma.shiftSignup.findUnique({
		where: { shiftId_userId: { shiftId, userId } },
		select: { id: true },
	});
	if (existing) return existing;
	return prisma.shiftSignup.create({
		data: { shiftId, userId, status, notes },
		select: { id: true },
	});
}
