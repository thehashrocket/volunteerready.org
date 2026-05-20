import type { RequirementLevel } from '@/prisma/generated/client';
import { geocodeLocation, getGeocodeApiKey } from '@/server/lib/geocode';
import {
	createOpportunity as repoCreate,
	updateOpportunity as repoUpdate,
} from '@/server/repositories/opportunityRepo';
import { prisma } from '@/server/repositories/prisma';

async function geocodeOpportunity(
	opportunityId: string,
	location: string | null | undefined,
): Promise<void> {
	if (!getGeocodeApiKey() || !location?.trim()) {
		await prisma.volunteerOpportunity.update({
			where: { id: opportunityId },
			data: { geocodeStatus: 'SKIPPED' },
		});
		return;
	}

	const result = await geocodeLocation(location);

	await prisma.volunteerOpportunity.update({
		where: { id: opportunityId },
		data:
			result.geocodeStatus === 'SUCCESS'
				? { geocodeStatus: 'SUCCESS', lat: result.lat, lng: result.lng }
				: { geocodeStatus: result.geocodeStatus, lat: null, lng: null },
	});
}

export async function createOpportunity(input: {
	orgId: string;
	title: string;
	description: string;
	location?: string | null;
	isRemote: boolean;
	startDate?: Date | null;
	endDate?: Date | null;
	commitmentHours?: number | null;
	capacity?: number | null;
	tags: string[];
	requirements: {
		skillId?: string;
		familyId?: string;
		level: RequirementLevel;
	}[];
}) {
	const result = await repoCreate(input);

	geocodeOpportunity(result.id, input.location).catch((err) =>
		console.error('[geocode] create failed for', result.id, err),
	);

	return result;
}

export async function updateOpportunity(
	id: string,
	orgId: string,
	input: {
		title?: string;
		description?: string;
		location?: string | null;
		isRemote?: boolean;
		startDate?: Date | null;
		endDate?: Date | null;
		commitmentHours?: number | null;
		capacity?: number | null;
		tags?: string[];
		requirements?: {
			skillId?: string;
			familyId?: string;
			level: RequirementLevel;
		}[];
	},
) {
	const result = await repoUpdate(id, orgId, input);

	if ('location' in input) {
		geocodeOpportunity(id, input.location).catch((err) =>
			console.error('[geocode] update failed for', id, err),
		);
	}

	return result;
}
