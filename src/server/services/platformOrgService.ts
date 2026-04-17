import { TRPCError } from '@trpc/server';
import {
	getOrgDetail,
	listOrgApplications,
	listOrgMembers,
	listOrgOpportunities,
	listOrgsPage,
} from '@/server/repositories/platformOrgRepo';

export async function listOrgs(input: {
	search?: string;
	cursor?: string | null;
	limit?: number;
}) {
	return listOrgsPage(input);
}

export async function getOrg(id: string) {
	const org = await getOrgDetail(id);
	if (!org) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found.',
		});
	}

	const [members, opportunities, applications] = await Promise.all([
		listOrgMembers(id),
		listOrgOpportunities(id),
		listOrgApplications(id),
	]);

	return { org, members, opportunities, applications };
}
