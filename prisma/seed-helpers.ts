import 'dotenv/config';
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
// Skill catalog (SkillFamily + Skill)
// ---------------------------------------------------------------------------

type SkillFamilyDef = {
	name: string;
	slug: string;
	skills: { name: string; slug: string }[];
};

export const SKILL_CATALOG: SkillFamilyDef[] = [
	{
		name: 'Microsoft Office',
		slug: 'microsoft-office',
		skills: [
			{ name: 'Word', slug: 'word' },
			{ name: 'Excel', slug: 'excel' },
			{ name: 'PowerPoint', slug: 'powerpoint' },
			{ name: 'Outlook', slug: 'outlook' },
		],
	},
	{
		name: 'Adobe Creative Suite',
		slug: 'adobe-creative-suite',
		skills: [
			{ name: 'Photoshop', slug: 'photoshop' },
			{ name: 'Illustrator', slug: 'illustrator' },
			{ name: 'InDesign', slug: 'indesign' },
			{ name: 'Premiere Pro', slug: 'premiere-pro' },
			{ name: 'Lightroom', slug: 'lightroom' },
		],
	},
	{
		name: 'Programming & Development',
		slug: 'programming-development',
		skills: [
			{ name: 'Python', slug: 'python' },
			{ name: 'JavaScript', slug: 'javascript' },
			{ name: 'TypeScript', slug: 'typescript' },
			{ name: 'SQL', slug: 'sql' },
			{ name: 'HTML/CSS', slug: 'html-css' },
		],
	},
	{
		name: 'Communication',
		slug: 'communication',
		skills: [
			{ name: 'Public Speaking', slug: 'public-speaking' },
			{ name: 'Grant Writing', slug: 'grant-writing' },
			{ name: 'Copywriting', slug: 'copywriting' },
			{ name: 'Technical Writing', slug: 'technical-writing' },
			{ name: 'Social Media Management', slug: 'social-media-management' },
		],
	},
	{
		name: 'Education & Training',
		slug: 'education-training',
		skills: [
			{ name: 'Teaching', slug: 'teaching' },
			{ name: 'Tutoring', slug: 'tutoring' },
			{ name: 'Curriculum Development', slug: 'curriculum-development' },
			{ name: 'Mentoring', slug: 'mentoring' },
		],
	},
	{
		name: 'Healthcare',
		slug: 'healthcare',
		skills: [
			{ name: 'First Aid/CPR', slug: 'first-aid-cpr' },
			{ name: 'Patient Care', slug: 'patient-care' },
			{ name: 'Mental Health Support', slug: 'mental-health-support' },
		],
	},
	{
		name: 'Finance & Accounting',
		slug: 'finance-accounting',
		skills: [
			{ name: 'Bookkeeping', slug: 'bookkeeping' },
			{ name: 'QuickBooks', slug: 'quickbooks' },
			{ name: 'Fundraising', slug: 'fundraising' },
			{ name: 'Grant Management', slug: 'grant-management' },
		],
	},
	{
		name: 'Project Management',
		slug: 'project-management',
		skills: [
			{ name: 'Volunteer Coordination', slug: 'volunteer-coordination' },
			{ name: 'Event Planning', slug: 'event-planning' },
			{ name: 'Project Planning', slug: 'project-planning' },
		],
	},
	{
		name: 'Languages',
		slug: 'languages',
		skills: [
			{ name: 'Spanish', slug: 'spanish' },
			{ name: 'French', slug: 'french' },
			{ name: 'Mandarin', slug: 'mandarin' },
			{ name: 'Arabic', slug: 'arabic' },
			{ name: 'American Sign Language (ASL)', slug: 'asl' },
		],
	},
	{
		name: 'Design & Creative',
		slug: 'design-creative',
		skills: [
			{ name: 'Graphic Design', slug: 'graphic-design' },
			{ name: 'Photography', slug: 'photography' },
			{ name: 'Videography', slug: 'videography' },
			{ name: 'Web Design', slug: 'web-design' },
			{ name: 'UX/UI Design', slug: 'ux-ui-design' },
		],
	},
	{
		name: 'Technology & IT',
		slug: 'technology-it',
		skills: [
			{ name: 'Salesforce (NPSP)', slug: 'salesforce-npsp' },
			{ name: 'Google Workspace', slug: 'google-workspace' },
			{ name: 'Database Management', slug: 'database-management' },
		],
	},
	{
		name: 'Social Services',
		slug: 'social-services',
		skills: [
			{ name: 'Case Management', slug: 'case-management' },
			{ name: 'Community Outreach', slug: 'community-outreach' },
			{ name: 'Youth Development', slug: 'youth-development' },
			{ name: 'Senior Care', slug: 'senior-care' },
		],
	},
	{
		name: 'Animal Care',
		slug: 'animal-care',
		skills: [
			{ name: 'Animal Handling', slug: 'animal-handling' },
			{ name: 'Dog Training', slug: 'dog-training' },
			{ name: 'Cat Socialization', slug: 'cat-socialization' },
			{ name: 'Wildlife Rehabilitation', slug: 'wildlife-rehabilitation' },
			{ name: 'Veterinary Assistance', slug: 'veterinary-assistance' },
			{
				name: 'Animal Behavior Assessment',
				slug: 'animal-behavior-assessment',
			},
			{ name: 'Foster Care (Animals)', slug: 'foster-care-animals' },
			{ name: 'Kennel Management', slug: 'kennel-management' },
			{ name: 'Animal Transport', slug: 'animal-transport' },
			{ name: 'Trap-Neuter-Return (TNR)', slug: 'trap-neuter-return' },
		],
	},
];

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

	return { skillBySlug, familyBySlug };
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
