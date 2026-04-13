import { prisma } from '@/server/repositories/prisma';

export async function upsertLead(data: {
	locationSlug: string;
	orgName: string;
	contactEmail: string;
	volunteerCount?: string;
	currentProcess?: string;
	painPoints?: string;
	utmSource?: string;
	utmCampaign?: string;
	utmContent?: string;
}) {
	return prisma.leadCapture.upsert({
		where: {
			contactEmail_locationSlug: {
				contactEmail: data.contactEmail.toLowerCase(),
				locationSlug: data.locationSlug,
			},
		},
		update: {
			orgName: data.orgName,
			volunteerCount: data.volunteerCount ?? null,
			currentProcess: data.currentProcess ?? null,
			painPoints: data.painPoints ?? null,
			deletedAt: null,
			// UTM fields intentionally omitted — first-touch attribution
		},
		create: {
			locationSlug: data.locationSlug,
			orgName: data.orgName,
			contactEmail: data.contactEmail.toLowerCase(),
			volunteerCount: data.volunteerCount ?? null,
			currentProcess: data.currentProcess ?? null,
			painPoints: data.painPoints ?? null,
			utmSource: data.utmSource ?? null,
			utmCampaign: data.utmCampaign ?? null,
			utmContent: data.utmContent ?? null,
		},
	});
}

export async function listLeads(opts?: {
	locationSlug?: string;
	limit?: number;
	offset?: number;
}) {
	const where = {
		deletedAt: null,
		...(opts?.locationSlug ? { locationSlug: opts.locationSlug } : {}),
	};

	const [leads, total] = await Promise.all([
		prisma.leadCapture.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: opts?.limit ?? 50,
			skip: opts?.offset ?? 0,
		}),
		prisma.leadCapture.count({ where }),
	]);

	return { leads, total };
}
