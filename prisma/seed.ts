import 'dotenv/config';
import {
	PrismaClient,
	Role,
	ApplicationStatus,
	ScreeningStatus,
} from '../src/prisma/generated/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

type SeedQuestion = {
	key: string;
	prompt: string;
	type: string; // keep aligned with your Prisma enum values
	order: number;
	isActive: boolean;
	configJson: Record<string, unknown>;
};

async function ensureDevOrg() {
	const existing = await prisma.organization.findFirst({
		where: { slug: 'dev-organization' },
		select: { id: true, slug: true, name: true },
	});

	if (existing) {
		// If someone renamed it, normalize name for dev
		if (existing.name !== 'Dev Organization') {
			await prisma.organization.update({
				where: { id: existing.id },
				data: { name: 'Dev Organization' },
			});
		}
		return existing;
	}

	return prisma.organization.create({
		data: { name: 'Dev Organization', slug: 'dev-organization' },
		select: { id: true, slug: true, name: true },
	});
}

async function upsertQuestions(orgId: string, questions: SeedQuestion[]) {
	for (const q of questions) {
		await prisma.screenerQuestion.upsert({
			where: { orgId_key: { orgId, key: q.key } },
			update: {
				prompt: q.prompt,
				type: q.type as any,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as any,
			},
			create: {
				orgId,
				key: q.key,
				prompt: q.prompt,
				type: q.type as any,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as any,
			},
		});
	}
}

async function ensureDevAdmin(orgId: string) {
	const email = 'admin@volunteermatch.local';

	const user = await prisma.user.upsert({
		where: { email },
		update: { name: 'Dev Admin' },
		create: {
			name: 'Dev Admin',
			email,
		},
		select: { id: true, email: true },
	});

	await prisma.organizationMember.upsert({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: user.id,
			},
		},
		update: { role: Role.OWNER },
		create: {
			organizationId: orgId,
			userId: user.id,
			role: Role.OWNER,
		},
	});

	return user;
}

async function ensureDevVolunteer() {
	const email = 'volunteer@volunteermatch.local';

	return prisma.user.upsert({
		where: { email },
		update: { name: 'Dev Volunteer' },
		create: {
			name: 'Dev Volunteer',
			email,
		},
		select: { id: true, email: true },
	});
}

async function ensureFeatureFlags(orgId: string) {
	await prisma.featureFlag.upsert({
		where: { orgId_key: { orgId, key: 'volunteer_screener_v1' } },
		update: { enabled: true },
		create: { orgId, key: 'volunteer_screener_v1', enabled: true },
	});
}

async function getQuestionsByKey(orgId: string, keys: string[]) {
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

type SeedAppInput = {
	orgId: string;
	submittedByEmail: string;
	submittedByUserId?: string | null;
	status: ApplicationStatus;
	screeningStatus: ScreeningStatus;
	screeningReasons: unknown; // Json column
	answers: Array<{ questionKey: string; value: unknown }>;
};

async function createSeedApplication(input: SeedAppInput) {
	const questionKeys = input.answers.map((a) => a.questionKey);
	const qMap = await getQuestionsByKey(input.orgId, questionKeys);

	return prisma.volunteerApplication.create({
		data: {
			orgId: input.orgId,
			submittedByEmail: input.submittedByEmail,
			submittedByUserId: input.submittedByUserId ?? null,
			status: input.status as any,
			screeningStatus: input.screeningStatus as any,
			screeningReasons: input.screeningReasons as any,
			submittedAt: new Date(),
			answers: {
				create: input.answers.map((a) => ({
					questionId: qMap.get(a.questionKey)!,
					answerJson: a.value as any,
				})),
			},
		},
		select: { id: true },
	});
}

async function main() {
	const org = await ensureDevOrg();
	const orgId = org.id;
	const devVolunteer = await ensureDevVolunteer();

	// ✅ Better questions (no profile duplicates)
	// IMPORTANT: make sure these type values match your Prisma enum.
	// You currently used BOOLEAN / TEXT / SINGLE_CHOICE. I’m sticking with that.
	const defaultQuestions: SeedQuestion[] = [
		{
			key: 'age_18_plus',
			prompt: 'Are you 18 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Must be 18+.',
				},
			},
		},
		{
			key: 'reliable_transportation',
			prompt:
				'Do you have reliable transportation to get to the rescue location?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Reliable transportation is required.',
				},
			},
		},
		{
			key: 'follow_instructions',
			prompt:
				'Can you follow written and verbal instructions exactly (including safety protocols)?',
			type: 'BOOLEAN',
			order: 30,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Safety requires strict instruction-following.',
				},
			},
		},
		{
			key: 'lift_30_lbs',
			prompt: 'Are you able to lift and carry 30 pounds safely?',
			type: 'BOOLEAN',
			order: 40,
			isActive: true,
			configJson: {
				required: true,
				weightLbs: 30,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'This role requires lifting up to 30 lbs.',
				},
			},
		},
		{
			key: 'allergies',
			prompt:
				'Do you have allergies to cats or dogs that would limit volunteering?',
			type: 'SINGLE_CHOICE',
			order: 50,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'No allergies',
					'Mild allergies (manageable)',
					'Severe allergies',
				],
				rules: {
					reviewIf: { operator: 'equals', value: 'Severe allergies' },
					reason: 'May require role adjustments or accommodation.',
				},
			},
		},
		{
			key: 'comfort_reactive_animals',
			prompt:
				'How comfortable are you working around anxious or reactive animals?',
			type: 'SINGLE_CHOICE',
			order: 60,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'Not comfortable',
					'Somewhat comfortable',
					'Comfortable',
					'Very comfortable',
				],
				rules: {
					reviewIf: { operator: 'equals', value: 'Not comfortable' },
					reason: 'May be better suited to non-handling roles initially.',
				},
			},
		},
		{
			key: 'why_volunteer',
			prompt: 'Why do you want to volunteer with us?',
			type: 'TEXT',
			order: 70,
			isActive: true,
			configJson: { required: true, maxLength: 400 },
		},
		{
			key: 'attest_no_abuse',
			prompt: 'I confirm I have no history of animal abuse or neglect.',
			type: 'BOOLEAN',
			order: 80,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Cannot proceed without this attestation.',
				},
			},
		},
	];

	await upsertQuestions(orgId, defaultQuestions);

	// Seed sample applications (PASS / REVIEW / FAIL) so the UI isn't empty
	// To avoid duplicates on every seed run, use unique emails and upsert-ish behavior:
	const existingSamples = await prisma.volunteerApplication.findMany({
		where: {
			orgId,
			submittedByEmail: {
				in: [
					'sample-pass@volunteermatch.local',
					'sample-review@volunteermatch.local',
					'sample-fail@volunteermatch.local',
				],
			},
		},
		select: { submittedByEmail: true },
	});

	const existingSet = new Set(existingSamples.map((s) => s.submittedByEmail));

	if (!existingSet.has('sample-pass@volunteermatch.local')) {
		await createSeedApplication({
			orgId,
			submittedByEmail: 'sample-pass@volunteermatch.local',
			submittedByUserId: devVolunteer.id,
			status: 'SUBMITTED',
			screeningStatus: 'PASS',
			screeningReasons: [],
			answers: [
				{ questionKey: 'age_18_plus', value: true },
				{ questionKey: 'reliable_transportation', value: true },
				{ questionKey: 'follow_instructions', value: true },
				{ questionKey: 'lift_30_lbs', value: true },
				{ questionKey: 'allergies', value: 'No allergies' },
				{ questionKey: 'comfort_reactive_animals', value: 'Comfortable' },
				{
					questionKey: 'why_volunteer',
					value:
						'I love animals and I’m consistent. Happy to start with cleaning, feeding, and basic support tasks.',
				},
				{ questionKey: 'attest_no_abuse', value: true },
			],
		});
	}

	if (!existingSet.has('sample-review@volunteermatch.local')) {
		await createSeedApplication({
			orgId,
			submittedByEmail: 'sample-review@volunteermatch.local',
			status: 'REVIEW',
			screeningStatus: 'REVIEW',
			screeningReasons: [
				{
					code: 'ALLERGIES_SEVERE',
					message: 'Severe allergies may require role adjustments.',
				},
				{
					code: 'REACTIVE_COMFORT_LOW',
					message:
						'Not comfortable with reactive animals; consider non-handling roles.',
				},
			],
			answers: [
				{ questionKey: 'age_18_plus', value: true },
				{ questionKey: 'reliable_transportation', value: true },
				{ questionKey: 'follow_instructions', value: true },
				{ questionKey: 'lift_30_lbs', value: true },
				{ questionKey: 'allergies', value: 'Severe allergies' },
				{ questionKey: 'comfort_reactive_animals', value: 'Not comfortable' },
				{
					questionKey: 'why_volunteer',
					value:
						'I want to help but I’m new. I’m open to admin tasks, laundry, food prep, and cleaning.',
				},
				{ questionKey: 'attest_no_abuse', value: true },
			],
		});
	}

	if (!existingSet.has('sample-fail@volunteermatch.local')) {
		await createSeedApplication({
			orgId,
			submittedByEmail: 'sample-fail@volunteermatch.local',
			status: 'REJECTED',
			screeningStatus: 'FAIL',
			screeningReasons: [
				{
					code: 'UNDER_18',
					message: 'Must be 18 years or older.',
				},
			],
			answers: [
				{ questionKey: 'age_18_plus', value: false },
				{ questionKey: 'reliable_transportation', value: true },
				{ questionKey: 'follow_instructions', value: true },
				{ questionKey: 'lift_30_lbs', value: true },
				{ questionKey: 'allergies', value: 'No allergies' },
				{
					questionKey: 'comfort_reactive_animals',
					value: 'Somewhat comfortable',
				},
				{
					questionKey: 'why_volunteer',
					value: 'I need volunteer hours for school.',
				},
				{ questionKey: 'attest_no_abuse', value: true },
			],
		});
	}

	await ensureDevAdmin(orgId);
	await ensureFeatureFlags(orgId);

	console.log(
		'Seed complete: dev org, dev admin, feature flags, screener questions',
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
