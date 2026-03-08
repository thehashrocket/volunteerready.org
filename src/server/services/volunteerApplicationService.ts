// src/server/services/volunteerApplicationService.ts
import { TRPCError } from '@trpc/server';
import { prisma } from '@/server/repositories/prisma';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';

export async function submitVolunteerApplicationBySlug(
	orgSlug: string,
	args: {
		submittedByEmail: string;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic volunteer profile shape
		profile: any;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic form responses
		responses: any[];
	},
) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true },
	});

	if (!org) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found.',
		});
	}

	return submitVolunteerApplication(org.id, args);
}
