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
] as const;

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_REGISTRY.map((f) => f.key);

export function getFlagDefinition(
	key: string,
): FeatureFlagDefinition | undefined {
	return FEATURE_FLAG_REGISTRY.find((f) => f.key === key);
}

export function isKnownFlag(key: string): boolean {
	return FEATURE_FLAG_REGISTRY.some((f) => f.key === key);
}
