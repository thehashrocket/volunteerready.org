import 'dotenv/config';
import { PrismaClient, Role } from '../src/prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
	throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

async function main() {
	const existingOrg = await prisma.organization.findFirst({
		where: { name: 'Dev Organization' },
		select: { id: true, slug: true },
	});
	const org =
		existingOrg ??
		(await prisma.organization.create({
			data: { name: 'Dev Organization', slug: 'dev-organization' },
		}));

	if (!org) {
		throw new Error('Dev Organization not found. Create it first in seed.');
	}

	if (!org.slug) {
		await prisma.organization.update({
			where: { id: org.id },
			data: { slug: 'dev-organization' },
		});
	}

	// Default questions (rescue-first, disqualifiers baked in)
	const defaultQuestions = [
		{
			key: 'age_18_plus',
			prompt: 'Are you 18 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				disqualifierRule: {
					operator: 'equals',
					value: false,
				},
				reason: 'Must be 18+.',
			},
		},
		{
			key: 'reliable_transportation',
			prompt: 'Do you have reliable transportation to get to the rescue?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: {
				disqualifierRule: {
					operator: 'equals',
					value: false,
				},
				reason: 'Reliable transportation is required.',
			},
		},
		{
			key: 'can_follow_instructions',
			prompt:
				'Can you follow written and verbal instructions exactly (including safety protocols)?',
			type: 'BOOLEAN',
			order: 30,
			isActive: true,
			configJson: {
				disqualifierRule: {
					operator: 'equals',
					value: false,
				},
				reason: 'Safety requires strict instruction-following.',
			},
		},
		{
			key: 'availability',
			prompt: 'What days/times are you generally available?',
			type: 'TEXT',
			order: 40,
			isActive: true,
			configJson: { maxLength: 400 },
		},
		{
			key: 'experience_level',
			prompt: 'Which best describes your animal care experience?',
			type: 'SINGLE_CHOICE',
			order: 50,
			isActive: true,
			configJson: {
				options: [
					'None',
					'Some (pets at home)',
					'Volunteer experience',
					'Professional experience',
				],
			},
		},
	] as const;

	// Upsert by (orgId, key)
	for (const q of defaultQuestions) {
		await prisma.screenerQuestion.upsert({
			where: { orgId_key: { orgId: org.id, key: q.key } },
			update: {
				prompt: q.prompt,
				type: q.type as any,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as any,
			},
			create: {
				orgId: org.id,
				key: q.key,
				prompt: q.prompt,
				type: q.type as any,
				order: q.order,
				isActive: q.isActive,
				configJson: q.configJson as any,
			},
		});
	}

	const user = await prisma.user.upsert({
		where: { email: 'admin@volunteeermatch.local' },
		update: { name: 'Dev Admin' },
		create: {
			name: 'Dev Admin',
			email: 'admin@volunteeermatch.local',
			memberships: {
				create: {
					organizationId: org.id,
					role: Role.OWNER,
				},
			},
		},
	});

	await prisma.organizationMember.upsert({
		where: {
			organizationId_userId: {
				organizationId: org.id,
				userId: user.id,
			},
		},
		update: { role: Role.OWNER },
		create: {
			organizationId: org.id,
			userId: user.id,
			role: Role.OWNER,
		},
	});

	await prisma.featureFlag.upsert({
		where: {
			orgId_key: {
				orgId: org.id,
				key: 'volunteer_screener_v1',
			},
		},
		update: { enabled: true },
		create: {
			orgId: org.id,
			key: 'volunteer_screener_v1',
			enabled: true,
		},
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
