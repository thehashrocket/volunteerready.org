/**
 * Reference Data — canonical skill catalog and platform org configuration.
 *
 * Pure data, no Prisma dependency. Both `prisma/seed-helpers.ts` and the
 * runtime `referenceDataService` import from here.
 */

// ---------------------------------------------------------------------------
// Version tracking
// ---------------------------------------------------------------------------

/** Bump when adding/removing/renaming skills or families. */
export const CATALOG_VERSION = 1;

// ---------------------------------------------------------------------------
// Platform org
// ---------------------------------------------------------------------------

export const PLATFORM_ORG_SLUG = 'platform';
export const PLATFORM_ORG_NAME = 'VolunteerReady Platform';

// ---------------------------------------------------------------------------
// Skill catalog
// ---------------------------------------------------------------------------

export type SkillFamilyDef = {
	name: string;
	slug: string;
	skills: { name: string; slug: string }[];
};

export const SKILL_CATALOG: SkillFamilyDef[] = [
	{
		name: 'Microsoft Office',
		slug: 'microsoft-office',
		skills: [
			{ name: 'Word', slug: 'word' },
			{ name: 'Excel', slug: 'excel' },
			{ name: 'PowerPoint', slug: 'powerpoint' },
			{ name: 'Outlook', slug: 'outlook' },
		],
	},
	{
		name: 'Adobe Creative Suite',
		slug: 'adobe-creative-suite',
		skills: [
			{ name: 'Photoshop', slug: 'photoshop' },
			{ name: 'Illustrator', slug: 'illustrator' },
			{ name: 'InDesign', slug: 'indesign' },
			{ name: 'Premiere Pro', slug: 'premiere-pro' },
			{ name: 'Lightroom', slug: 'lightroom' },
		],
	},
	{
		name: 'Programming & Development',
		slug: 'programming-development',
		skills: [
			{ name: 'Python', slug: 'python' },
			{ name: 'JavaScript', slug: 'javascript' },
			{ name: 'TypeScript', slug: 'typescript' },
			{ name: 'SQL', slug: 'sql' },
			{ name: 'HTML/CSS', slug: 'html-css' },
		],
	},
	{
		name: 'Communication',
		slug: 'communication',
		skills: [
			{ name: 'Public Speaking', slug: 'public-speaking' },
			{ name: 'Grant Writing', slug: 'grant-writing' },
			{ name: 'Copywriting', slug: 'copywriting' },
			{ name: 'Technical Writing', slug: 'technical-writing' },
			{ name: 'Social Media Management', slug: 'social-media-management' },
		],
	},
	{
		name: 'Education & Training',
		slug: 'education-training',
		skills: [
			{ name: 'Teaching', slug: 'teaching' },
			{ name: 'Tutoring', slug: 'tutoring' },
			{ name: 'Curriculum Development', slug: 'curriculum-development' },
			{ name: 'Mentoring', slug: 'mentoring' },
		],
	},
	{
		name: 'Healthcare',
		slug: 'healthcare',
		skills: [
			{ name: 'First Aid/CPR', slug: 'first-aid-cpr' },
			{ name: 'Patient Care', slug: 'patient-care' },
			{ name: 'Mental Health Support', slug: 'mental-health-support' },
		],
	},
	{
		name: 'Finance & Accounting',
		slug: 'finance-accounting',
		skills: [
			{ name: 'Bookkeeping', slug: 'bookkeeping' },
			{ name: 'QuickBooks', slug: 'quickbooks' },
			{ name: 'Fundraising', slug: 'fundraising' },
			{ name: 'Grant Management', slug: 'grant-management' },
		],
	},
	{
		name: 'Project Management',
		slug: 'project-management',
		skills: [
			{ name: 'Volunteer Coordination', slug: 'volunteer-coordination' },
			{ name: 'Event Planning', slug: 'event-planning' },
			{ name: 'Project Planning', slug: 'project-planning' },
		],
	},
	{
		name: 'Languages',
		slug: 'languages',
		skills: [
			{ name: 'Spanish', slug: 'spanish' },
			{ name: 'French', slug: 'french' },
			{ name: 'Mandarin', slug: 'mandarin' },
			{ name: 'Arabic', slug: 'arabic' },
			{ name: 'American Sign Language (ASL)', slug: 'asl' },
		],
	},
	{
		name: 'Design & Creative',
		slug: 'design-creative',
		skills: [
			{ name: 'Graphic Design', slug: 'graphic-design' },
			{ name: 'Photography', slug: 'photography' },
			{ name: 'Videography', slug: 'videography' },
			{ name: 'Web Design', slug: 'web-design' },
			{ name: 'UX/UI Design', slug: 'ux-ui-design' },
		],
	},
	{
		name: 'Technology & IT',
		slug: 'technology-it',
		skills: [
			{ name: 'Salesforce (NPSP)', slug: 'salesforce-npsp' },
			{ name: 'Google Workspace', slug: 'google-workspace' },
			{ name: 'Database Management', slug: 'database-management' },
		],
	},
	{
		name: 'Social Services',
		slug: 'social-services',
		skills: [
			{ name: 'Case Management', slug: 'case-management' },
			{ name: 'Community Outreach', slug: 'community-outreach' },
			{ name: 'Youth Development', slug: 'youth-development' },
			{ name: 'Senior Care', slug: 'senior-care' },
		],
	},
	{
		name: 'Animal Care',
		slug: 'animal-care',
		skills: [
			{ name: 'Animal Handling', slug: 'animal-handling' },
			{ name: 'Dog Training', slug: 'dog-training' },
			{ name: 'Cat Socialization', slug: 'cat-socialization' },
			{ name: 'Wildlife Rehabilitation', slug: 'wildlife-rehabilitation' },
			{ name: 'Veterinary Assistance', slug: 'veterinary-assistance' },
			{
				name: 'Animal Behavior Assessment',
				slug: 'animal-behavior-assessment',
			},
			{ name: 'Foster Care (Animals)', slug: 'foster-care-animals' },
			{ name: 'Kennel Management', slug: 'kennel-management' },
			{ name: 'Animal Transport', slug: 'animal-transport' },
			{ name: 'Trap-Neuter-Return (TNR)', slug: 'trap-neuter-return' },
		],
	},
];

/** Computed counts for logging/assertions. */
export const EXPECTED_FAMILY_COUNT = SKILL_CATALOG.length;
export const EXPECTED_SKILL_COUNT = SKILL_CATALOG.reduce(
	(sum, f) => sum + f.skills.length,
	0,
);
