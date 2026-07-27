export type FeatureFlagDefinition = {
	key: string;
	label: string;
	description: string;
	defaultEnabled: boolean;
};

export const FEATURE_FLAG_REGISTRY: readonly FeatureFlagDefinition[] = [
	{
		key: 'beta_features',
		label: 'Beta features',
		description:
			'Opt this org into beta features that are not yet generally available.',
		defaultEnabled: false,
	},
	{
		key: 'case_study_generation',
		label: 'Case study generation',
		description:
			'Allow platform staff to generate and publish case studies for this org.',
		defaultEnabled: false,
	},
	{
		key: 'advanced_dashboard',
		label: 'Advanced dashboard',
		description:
			'Show advanced analytics and reporting widgets on the org dashboard.',
		defaultEnabled: false,
	},
	{
		key: 'referrals_enabled',
		label: 'Referrals',
		description:
			'Enable the volunteer referral landing page and prompts for this org.',
		defaultEnabled: true,
	},
	{
		// Gates FOUR staff surfaces, not just the roster page: /app/volunteers,
		// the assign picker inside ShiftDetailDialog, the shift-reminder
		// suppression disclosure, and roster events in the activity feed.
		// Deliberately does NOT gate OrgVolunteer row creation on application
		// approval (so the roster is already warm when the flag flips) or the
		// volunteer's own "leave this roster" control (the rows exist either way,
		// so the exit must too).
		key: 'staff_created_volunteers',
		label: 'Staff-created volunteers',
		description:
			'Let staff add volunteers to a roster and schedule them without the volunteer signing up first.',
		defaultEnabled: false,
	},
] as const;

/**
 * Key for the staff-created volunteer roster, exported so the app shell and
 * route guards cannot drift from the registry by typo — an unknown key silently
 * resolves to `false` in `isFeatureEnabled`, which would look like "the flag is
 * off" rather than "the flag name is wrong".
 */
export const STAFF_CREATED_VOLUNTEERS_FLAG = 'staff_created_volunteers';

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_REGISTRY.map((f) => f.key);

export function getFlagDefinition(
	key: string,
): FeatureFlagDefinition | undefined {
	return FEATURE_FLAG_REGISTRY.find((f) => f.key === key);
}

export function isKnownFlag(key: string): boolean {
	return FEATURE_FLAG_REGISTRY.some((f) => f.key === key);
}
