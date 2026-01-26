import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import {
	getApplicationDetail,
	listApplications,
} from '@/server/repositories/volunteer-applications';

export async function listOrgApplications(
	orgId: string,
	input: { status?: string; page?: number; pageSize?: number },
) {
	return listApplications(orgId, input.status as any, {
		page: input.page,
		pageSize: input.pageSize,
	});
}

export async function getOrgApplicationDetail(orgId: string, id: string) {
	return getApplicationDetail(orgId, id);
}

export async function getPublicScreenerForm(orgSlug: string) {
	return getPublicFormByOrgSlug(orgSlug);
}
