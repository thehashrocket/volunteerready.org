/**
 * Global advisory permission middleware.
 *
 * Maps tRPC procedure paths to permission keys and runs advisory checks.
 * Never blocks — only logs warnings when middleware-allowed requests would
 * be denied by hasPermission(). Remove after full migration is verified.
 */
import type { Role } from '@/prisma/generated/client';
import { advisoryPermissionCheck } from '@/server/domain/permissions';

/**
 * Procedure path → permission key mapping.
 *
 * Only org-scoped procedures are mapped. Public, protected (own-data),
 * platform admin, and company procedures are excluded since they aren't
 * gated by org role.
 */
const PROCEDURE_PERMISSION_MAP: Record<string, string> = {
	// --- Screener (admin) ---
	'screener.list': 'screener.list',
	'screener.detail': 'screener.detail',
	'screener.updateApplicationStatus': 'screener.updateStatus',
	'screener.getDashboardStats': 'screener.dashboardStats',
	'screener.getActivityFeed': 'screener.activityFeed',
	'screener.getImpactReport': 'screener.impactReport',
	'screener.getOnboardingBaseline': 'screener.onboardingBaseline',
	'screener.saveOnboardingBaseline': 'screener.saveOnboardingBaseline',
	'screener.dismissOnboardingChecklist': 'screener.dismissOnboarding',
	'screener.listQuestions': 'screener.listQuestions',
	'screener.createQuestion': 'screener.createQuestion',
	'screener.updateQuestion': 'screener.updateQuestion',
	'screener.setQuestionActive': 'screener.setQuestionActive',
	'screener.moveQuestion': 'screener.moveQuestion',
	'screener.deleteQuestion': 'screener.deleteQuestion',

	// --- Members (admin) ---
	'members.list': 'members.list',
	'members.invite': 'members.invite',
	'members.removeMember': 'members.removeMember',
	'members.updateRole': 'members.updateRole',

	// --- Opportunities (staff) ---
	'opportunities.list': 'opportunities.list',
	'opportunities.get': 'opportunities.get',
	'opportunities.create': 'opportunities.create',
	'opportunities.update': 'opportunities.update',
	'opportunities.updateStatus': 'opportunities.updateStatus',
	'opportunities.remove': 'opportunities.remove',

	// --- Shifts (staff) ---
	'shifts.list': 'shifts.list',
	'shifts.getById': 'shifts.getById',
	'shifts.create': 'shifts.create',
	'shifts.update': 'shifts.update',
	'shifts.cancel': 'shifts.cancel',
	'shifts.complete': 'shifts.complete',
	'shifts.remove': 'shifts.remove',
	'shifts.getSignups': 'shifts.getSignups',
	'shifts.markAttendance': 'shifts.markAttendance',
	'shifts.checkinByQr': 'shifts.checkinByQr',
	'shifts.getCheckinStats': 'shifts.getCheckinStats',
	'shifts.getWaitlist': 'shifts.getWaitlist',

	// --- Shift Templates (staff + plan-gated) ---
	'shiftTemplates.list': 'shiftTemplates.list',
	'shiftTemplates.create': 'shiftTemplates.create',
	'shiftTemplates.update': 'shiftTemplates.update',
	'shiftTemplates.remove': 'shiftTemplates.remove',
	'shiftTemplates.generate': 'shiftTemplates.generate',

	// --- Credentials (staff) ---
	'credentials.listOrgCredentials': 'credentials.listOrgCredentials',
	'credentials.issue': 'credentials.issue',
	'credentials.revoke': 'credentials.revoke',
	'credentials.remove': 'credentials.remove',

	// --- Credential Sharing (staff) ---
	'credentialSharing.claim': 'credentialSharing.claim',
	'credentialSharing.externalCredentialCount':
		'credentialSharing.externalCredentialCount',
	'credentialSharing.requestSharing': 'credentialSharing.requestSharing',

	// --- Background Checks (staff/admin) ---
	'backgroundChecks.initiate': 'backgroundChecks.initiate',
	'backgroundChecks.listByOrg': 'backgroundChecks.listByOrg',
	'backgroundChecks.cancel': 'backgroundChecks.cancel',
	'backgroundChecks.sendPreAdverseNotice':
		'backgroundChecks.sendPreAdverseNotice',
	'backgroundChecks.finalizeAdverseAction':
		'backgroundChecks.finalizeAdverseAction',
	'backgroundChecks.resolveFcra': 'backgroundChecks.resolveFcra',
	'backgroundChecks.getCheckrOAuthUrl': 'backgroundChecks.getCheckrOAuthUrl',
	'backgroundChecks.getCheckrStatus': 'backgroundChecks.getCheckrStatus',
	'backgroundChecks.disconnectCheckr': 'backgroundChecks.disconnectCheckr',
	'backgroundChecks.connectSterling': 'backgroundChecks.connectSterling',
	'backgroundChecks.getSterlingStatus': 'backgroundChecks.getSterlingStatus',
	'backgroundChecks.disconnectSterling': 'backgroundChecks.disconnectSterling',

	// --- Billing (org) ---
	'billing.createCheckoutSession': 'billing.createCheckoutSession',
	'billing.getBillingStatus': 'billing.getBillingStatus',
	'billing.createPortalSession': 'billing.createPortalSession',

	// --- Bulk Import (admin) ---
	'bulkImport.start': 'bulkImport.start',
	'bulkImport.get': 'bulkImport.get',
	'bulkImport.list': 'bulkImport.list',

	// --- Analytics (plan-gated) ---
	'analytics.getDashboard': 'analytics.getDashboard',

	// --- Org (org/staff) ---
	'org.getCurrentOrg': 'org.getCurrentOrg',
	'org.updateQrColor': 'org.updateQrColor',
	'org.updateTimezone': 'org.updateTimezone',

	// --- Notifications (org) ---
	'notifications.getPreferences': 'notifications.getPreferences',
	'notifications.updatePreference': 'notifications.updatePreference',
	'notifications.getDigestPreference': 'notifications.getDigestPreference',
	'notifications.updateDigestPreference':
		'notifications.updateDigestPreference',

	// --- Onboarding (org) ---
	'onboarding.status': 'onboarding.status',
	'onboarding.dismiss': 'onboarding.dismiss',

	// --- Discovery (staff) ---
	'discovery.searchVolunteers': 'discovery.searchVolunteers',
	'discovery.inviteToApply': 'discovery.inviteToApply',

	// --- Matching (staff) ---
	'matching.getApplicationScores': 'matching.getApplicationScores',
};

/**
 * Run the advisory permission check for an org-scoped procedure.
 *
 * Call this from the global tRPC middleware. It looks up the procedure path
 * in the map and, if found, runs the advisory check against the user's role.
 */
export function runAdvisoryCheck(
	procedurePath: string,
	role: Role | null | undefined,
): void {
	if (!role) return;

	const permission = PROCEDURE_PERMISSION_MAP[procedurePath];
	if (!permission) return; // Not an org-scoped procedure — skip

	advisoryPermissionCheck(role, permission, procedurePath);
}
