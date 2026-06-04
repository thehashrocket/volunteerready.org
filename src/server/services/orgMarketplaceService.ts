import { prisma } from '@/server/repositories/prisma';

export interface UpdateMarketplaceSettingsInput {
	marketplaceVisible?: boolean;
	description?: string | null;
	location?: string | null;
	causeAreaTags?: string[];
}

export async function updateMarketplaceSettings(
	orgId: string,
	input: UpdateMarketplaceSettingsInput,
): Promise<void> {
	await prisma.organization.update({
		where: { id: orgId },
		data: {
			...(input.marketplaceVisible !== undefined
				? { marketplaceVisible: input.marketplaceVisible }
				: {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			...(input.location !== undefined ? { location: input.location } : {}),
			...(input.causeAreaTags !== undefined
				? { causeAreaTags: input.causeAreaTags }
				: {}),
		},
	});
}
