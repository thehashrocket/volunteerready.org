/**
 * RBAC Permission Constants + hasPermission() utility.
 *
 * Source of truth for the permission model. TypeScript constants only — no DB
 * tables in v1 (add Permission/RolePermission when custom roles are needed).
 *
 * Permission keys are flat: dots are cosmetic naming conventions (namespace.action).
 * No prefix-matching or wildcard logic exists.
 *
 * Inline business rules (ADMIN can't invite ADMIN, OWNER immutability) stay in
 * services — this file only models role-to-permission mappings.
 */
import type { Role } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Permission key catalog
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
	// --- Screener / Applications ---
	'screener.submit': 'screener.submit', // public (no role needed)
	'screener.list': 'screener.list',
	'screener.detail': 'screener.detail',
	'screener.updateStatus': 'screener.updateStatus',
	'screener.dashboardStats': 'screener.dashboardStats',
	'screener.activityFeed': 'screener.activityFeed',
	'screener.impactReport': 'screener.impactReport',
	'screener.onboardingBaseline': 'screener.onboardingBaseline',
	'screener.saveOnboardingBaseline': 'screener.saveOnboardingBaseline',
	'screener.dismissOnboarding': 'screener.dismissOnboarding',
	'screener.publicForm': 'screener.publicForm', // public
	'screener.myApplications': 'screener.myApplications', // protected (own data)
	'screener.myApplicationDetail': 'screener.myApplicationDetail', // protected (own data)
	'screener.myApplicationTimeline': 'screener.myApplicationTimeline', // protected (own data)

	// --- Screener Questions ---
	'screener.listQuestions': 'screener.listQuestions',
	'screener.createQuestion': 'screener.createQuestion',
	'screener.updateQuestion': 'screener.updateQuestion',
	'screener.setQuestionActive': 'screener.setQuestionActive',
	'screener.moveQuestion': 'screener.moveQuestion',
	'screener.deleteQuestion': 'screener.deleteQuestion',

	// --- Members ---
	'members.list': 'members.list',
	'members.invite': 'members.invite',
	'members.removeMember': 'members.removeMember',
	'members.updateRole': 'members.updateRole',
	'members.getInvitation': 'members.getInvitation', // public
	'members.accept': 'members.accept', // protected

	// --- Opportunities ---
	'opportunities.list': 'opportunities.list',
	'opportunities.get': 'opportunities.get',
	'opportunities.create': 'opportunities.create',
	'opportunities.update': 'opportunities.update',
	'opportunities.updateStatus': 'opportunities.updateStatus',
	'opportunities.remove': 'opportunities.remove',

	// --- Shifts ---
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
	'shifts.myUpcoming': 'shifts.myUpcoming', // protected (own data)
	'shifts.signup': 'shifts.signup', // protected (own data)
	'shifts.cancelSignup': 'shifts.cancelSignup', // protected (own data)
	'shifts.myUpcomingWithWaitlist': 'shifts.myUpcomingWithWaitlist', // protected (own data)
	'shifts.joinWaitlist': 'shifts.joinWaitlist', // protected (own data)
	'shifts.leaveWaitlist': 'shifts.leaveWaitlist', // protected (own data)
	'shifts.getCheckinToken': 'shifts.getCheckinToken', // protected (own data)
	'shifts.selfCheckin': 'shifts.selfCheckin', // protected (own data)
	'shifts.myCheckinStatus': 'shifts.myCheckinStatus', // protected (own data)

	// --- Shift Templates ---
	'shiftTemplates.list': 'shiftTemplates.list',
	'shiftTemplates.create': 'shiftTemplates.create',
	'shiftTemplates.update': 'shiftTemplates.update',
	'shiftTemplates.remove': 'shiftTemplates.remove',
	'shiftTemplates.generate': 'shiftTemplates.generate',

	// --- Credentials ---
	'credentials.listOrgCredentials': 'credentials.listOrgCredentials',
	'credentials.issue': 'credentials.issue',
	'credentials.revoke': 'credentials.revoke',
	'credentials.remove': 'credentials.remove',
	'credentials.getMyCredentials': 'credentials.getMyCredentials', // protected (own data)

	// --- Credential Sharing ---
	'credentialSharing.claim': 'credentialSharing.claim',
	'credentialSharing.externalCredentialCount':
		'credentialSharing.externalCredentialCount',
	'credentialSharing.requestSharing': 'credentialSharing.requestSharing',
	'credentialSharing.generate': 'credentialSharing.generate', // protected (own data)
	'credentialSharing.listMyTokens': 'credentialSharing.listMyTokens', // protected (own data)
	'credentialSharing.revokeToken': 'credentialSharing.revokeToken', // protected (own data)
	'credentialSharing.getTokenInfo': 'credentialSharing.getTokenInfo', // public
	'credentialSharing.shareCount': 'credentialSharing.shareCount', // protected (own data)

	// --- Background Checks ---
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

	// --- Billing ---
	'billing.createCheckoutSession': 'billing.createCheckoutSession',
	'billing.getBillingStatus': 'billing.getBillingStatus',
	'billing.createPortalSession': 'billing.createPortalSession',

	// --- Bulk Import ---
	'bulkImport.start': 'bulkImport.start',
	'bulkImport.get': 'bulkImport.get',
	'bulkImport.list': 'bulkImport.list',

	// --- Analytics ---
	'analytics.getDashboard': 'analytics.getDashboard',

	// --- Org ---
	'org.getCurrentOrg': 'org.getCurrentOrg',
	'org.updateQrColor': 'org.updateQrColor',
	'org.updateTimezone': 'org.updateTimezone',

	// --- Notifications ---
	'notifications.getPreferences': 'notifications.getPreferences',
	'notifications.updatePreference': 'notifications.updatePreference',
	'notifications.getDigestPreference': 'notifications.getDigestPreference',
	'notifications.updateDigestPreference':
		'notifications.updateDigestPreference',

	// --- Onboarding ---
	'onboarding.status': 'onboarding.status',
	'onboarding.dismiss': 'onboarding.dismiss',

	// --- Discovery ---
	'discovery.searchVolunteers': 'discovery.searchVolunteers',
	'discovery.inviteToApply': 'discovery.inviteToApply',

	// --- Matching ---
	'matching.getApplicationScores': 'matching.getApplicationScores',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ---------------------------------------------------------------------------
// Role-to-permission mappings
//
// These map the current 4-tier org roles to permission sets.
// OWNER inherits all of ADMIN, ADMIN inherits all of STAFF, STAFF inherits
// all of READONLY.
//
// Note: "protected (own data)" and "public" permissions are not gated by
// org role — they're listed in PERMISSIONS for documentation but aren't
// included in role mappings since middleware handles them differently.
// ---------------------------------------------------------------------------

const READONLY_PERMISSIONS: ReadonlySet<string> = new Set([
	// Read access across modules
	PERMISSIONS['org.getCurrentOrg'],
	PERMISSIONS['onboarding.status'],
	PERMISSIONS['onboarding.dismiss'],
	PERMISSIONS['billing.getBillingStatus'],
	PERMISSIONS['notifications.getPreferences'],
	PERMISSIONS['notifications.updatePreference'],
	PERMISSIONS['notifications.getDigestPreference'],
	PERMISSIONS['notifications.updateDigestPreference'],
	PERMISSIONS['billing.createCheckoutSession'],
	PERMISSIONS['billing.createPortalSession'],
]);

const STAFF_PERMISSIONS: ReadonlySet<string> = new Set([
	...READONLY_PERMISSIONS,
	// Operational
	PERMISSIONS['opportunities.list'],
	PERMISSIONS['opportunities.get'],
	PERMISSIONS['opportunities.create'],
	PERMISSIONS['opportunities.update'],
	PERMISSIONS['opportunities.updateStatus'],
	PERMISSIONS['opportunities.remove'],
	PERMISSIONS['shifts.list'],
	PERMISSIONS['shifts.getById'],
	PERMISSIONS['shifts.create'],
	PERMISSIONS['shifts.update'],
	PERMISSIONS['shifts.cancel'],
	PERMISSIONS['shifts.complete'],
	PERMISSIONS['shifts.remove'],
	PERMISSIONS['shifts.getSignups'],
	PERMISSIONS['shifts.markAttendance'],
	PERMISSIONS['shifts.checkinByQr'],
	PERMISSIONS['shifts.getCheckinStats'],
	PERMISSIONS['shifts.getWaitlist'],
	PERMISSIONS['shiftTemplates.list'],
	PERMISSIONS['shiftTemplates.create'],
	PERMISSIONS['shiftTemplates.update'],
	PERMISSIONS['shiftTemplates.remove'],
	PERMISSIONS['shiftTemplates.generate'],
	PERMISSIONS['credentials.listOrgCredentials'],
	PERMISSIONS['credentials.issue'],
	PERMISSIONS['credentials.revoke'],
	PERMISSIONS['credentials.remove'],
	PERMISSIONS['credentialSharing.claim'],
	PERMISSIONS['credentialSharing.externalCredentialCount'],
	PERMISSIONS['credentialSharing.requestSharing'],
	PERMISSIONS['backgroundChecks.initiate'],
	PERMISSIONS['backgroundChecks.listByOrg'],
	PERMISSIONS['backgroundChecks.cancel'],
	PERMISSIONS['backgroundChecks.sendPreAdverseNotice'],
	PERMISSIONS['backgroundChecks.finalizeAdverseAction'],
	PERMISSIONS['backgroundChecks.resolveFcra'],
	PERMISSIONS['backgroundChecks.getCheckrStatus'],
	PERMISSIONS['backgroundChecks.getSterlingStatus'],
	PERMISSIONS['discovery.searchVolunteers'],
	PERMISSIONS['discovery.inviteToApply'],
	PERMISSIONS['matching.getApplicationScores'],
	PERMISSIONS['org.updateQrColor'],
	PERMISSIONS['org.updateTimezone'],
	PERMISSIONS['analytics.getDashboard'],
]);

const ADMIN_PERMISSIONS: ReadonlySet<string> = new Set([
	...STAFF_PERMISSIONS,
	// Admin-level
	PERMISSIONS['screener.list'],
	PERMISSIONS['screener.detail'],
	PERMISSIONS['screener.updateStatus'],
	PERMISSIONS['screener.dashboardStats'],
	PERMISSIONS['screener.activityFeed'],
	PERMISSIONS['screener.impactReport'],
	PERMISSIONS['screener.onboardingBaseline'],
	PERMISSIONS['screener.saveOnboardingBaseline'],
	PERMISSIONS['screener.dismissOnboarding'],
	PERMISSIONS['screener.listQuestions'],
	PERMISSIONS['screener.createQuestion'],
	PERMISSIONS['screener.updateQuestion'],
	PERMISSIONS['screener.setQuestionActive'],
	PERMISSIONS['screener.moveQuestion'],
	PERMISSIONS['screener.deleteQuestion'],
	PERMISSIONS['members.list'],
	PERMISSIONS['members.invite'],
	PERMISSIONS['members.removeMember'],
	PERMISSIONS['members.updateRole'],
	PERMISSIONS['backgroundChecks.getCheckrOAuthUrl'],
	PERMISSIONS['backgroundChecks.disconnectCheckr'],
	PERMISSIONS['backgroundChecks.connectSterling'],
	PERMISSIONS['backgroundChecks.disconnectSterling'],
	PERMISSIONS['bulkImport.start'],
	PERMISSIONS['bulkImport.get'],
	PERMISSIONS['bulkImport.list'],
]);

const OWNER_PERMISSIONS: ReadonlySet<string> = new Set([
	...ADMIN_PERMISSIONS,
	// Owner — same as admin for now. When owner-only actions are added,
	// they go here. Currently the ADMIN-can't-invite-ADMIN restriction
	// is enforced as a business rule in memberService, not as a missing
	// permission.
]);

// ---------------------------------------------------------------------------
// Role → permission set map
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
	READONLY: READONLY_PERMISSIONS,
	STAFF: STAFF_PERMISSIONS,
	ADMIN: ADMIN_PERMISSIONS,
	OWNER: OWNER_PERMISSIONS,
};

// ---------------------------------------------------------------------------
// hasPermission()
// ---------------------------------------------------------------------------

/**
 * Check whether a role has a given permission.
 *
 * Operates on in-memory constants — no DB query per call.
 * Returns false for unknown roles or unknown permission keys.
 */
export function hasPermission(role: Role, permission: string): boolean {
	const perms = ROLE_PERMISSIONS[role];
	if (!perms) return false;
	return perms.has(permission);
}

/**
 * Get all permission keys granted to a role.
 */
export function getPermissionsForRole(role: Role): ReadonlySet<string> {
	return ROLE_PERMISSIONS[role] ?? new Set();
}

// ---------------------------------------------------------------------------
// Advisory mismatch logging
//
// During migration: existing middleware is authoritative. hasPermission() is
// advisory only — it never blocks. When middleware passes but hasPermission()
// would deny, we log a warning so seed mismatches are caught without breaking
// anything.
// ---------------------------------------------------------------------------

/**
 * Log a warning if middleware allowed access but hasPermission() disagrees.
 * Call this in each procedure after middleware has already passed.
 *
 * Never throws. Never blocks. Advisory only.
 */
export function advisoryPermissionCheck(
	role: Role,
	permission: string,
	procedureName: string,
): void {
	const allowed = hasPermission(role, permission);
	if (!allowed) {
		console.warn(
			`[RBAC advisory] Permission mismatch: role=${role} procedure=${procedureName} permission=${permission} — middleware allowed, hasPermission() denied`,
		);
	}
}
