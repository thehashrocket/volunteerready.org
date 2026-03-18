import type {
	AvailabilityType,
	PrismaClient,
	ProfileVisibility,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Profile reads
// ---------------------------------------------------------------------------

/** Get a volunteer profile by userId, or null if none exists. */
export async function getProfileByUserId(userId: string) {
	return prisma.volunteerProfile.findUnique({ where: { userId } });
}

/** Get profile + user identity fields together. */
export async function getProfileWithUser(userId: string) {
	return prisma.volunteerProfile.findUnique({
		where: { userId },
		include: {
			user: {
				select: { name: true, email: true, image: true, createdAt: true },
			},
		},
	});
}

// ---------------------------------------------------------------------------
// Profile writes (transactional)
// ---------------------------------------------------------------------------

export interface UpsertProfileInput {
	userId: string;
	bio?: string | null;
	phone?: string | null;
	city?: string | null;
	state?: string | null;
	country?: string | null;
	availability?: AvailabilityType;
	visibility?: ProfileVisibility;
	interests?: string[];
}

/** Upsert a volunteer profile inside a transaction. */
export async function upsertProfile(tx: TxClient, input: UpsertProfileInput) {
	const { userId, ...data } = input;

	return tx.volunteerProfile.upsert({
		where: { userId },
		create: { userId, ...data },
		update: data,
	});
}
