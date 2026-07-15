import {
	createApplicationIfNotExists,
	createOpportunityIfNotExists,
	createShiftIfNotExists,
	createSignupIfNotExists,
	daysAgo,
	daysFromNow,
	hoursFromNow,
	type Prisma,
	prisma,
	Role,
	type SeedQuestion,
	type ShareTokenStatus,
	seedTokenHash,
	upsertCredential,
	upsertFeatureFlag,
	upsertMember,
	upsertOrg,
	upsertProfile,
	upsertQuestions,
	upsertSkills,
	upsertUser,
} from './seed-helpers.js';
import { seedProduction } from './seed-production.js';

// ---------------------------------------------------------------------------
// Dev/staging seed — runs production seed first, then adds demo data.
// Includes dedicated test accounts for org admin and company admin roles.
// ---------------------------------------------------------------------------

async function seedDev() {
	// Run production seed first to get skill catalog
	const { skillBySlug, familyBySlug } = await seedProduction();

	console.log('\n🧪 Seeding dev/staging data...\n');

	// =========================================================================
	// Dedicated test accounts (easy login for dev/staging)
	// =========================================================================
	// Use these emails with the magic link flow to log in as each role.
	console.log('🔑 Creating dedicated test accounts...');

	const testOrgAdmin = await upsertUser(
		'orgadmin@volunteermatch.local',
		'Test Org Admin',
	);
	const testCompanyAdmin = await upsertUser(
		'companyadmin@volunteermatch.local',
		'Test Company Admin',
	);
	const testVolunteer = await upsertUser(
		'volunteer@volunteermatch.local',
		'Test Volunteer',
	);

	console.log(
		'   orgadmin@volunteermatch.local     — Org OWNER (Helping Hands)',
	);
	console.log(
		'   companyadmin@volunteermatch.local  — Company OWNER (Acme Corp)',
	);
	console.log(
		'   volunteer@volunteermatch.local     — Pure volunteer (no org role)',
	);

	// =========================================================================
	// 1. Organizations
	// =========================================================================
	console.log('\n📦 Creating organizations...');

	const helpingHands = await upsertOrg(
		'helping-hands',
		'Helping Hands Community Services',
	);
	const greenCity = await upsertOrg(
		'green-city-parks',
		'Green City Parks Conservancy',
	);
	const youthFutures = await upsertOrg(
		'youth-futures',
		'Youth Futures Mentoring',
	);
	// Slug stays 'dev-organization' (existing infra/tests reference it) but the
	// display name is shelter-themed — this org's screener questions/apps were
	// already shelter-flavored (comfort_reactive_animals, attest_no_abuse), so
	// it's reused as the /for/animal-shelters marketing screenshot subject
	// (issue #139 PR3) instead of seeding a whole new org from scratch.
	const devOrg = await upsertOrg(
		'dev-organization',
		'Riverside Animal Shelter',
	);

	// =========================================================================
	// 2. Feature flags
	// =========================================================================
	console.log('🚩 Setting feature flags...');

	for (const org of [helpingHands, greenCity, youthFutures, devOrg]) {
		await upsertFeatureFlag(org.id, 'volunteer_screener_v1', true);
	}
	await upsertFeatureFlag(youthFutures.id, 'shift_scheduling_v1', true);

	// =========================================================================
	// 3. Assign test accounts to orgs/companies
	// =========================================================================
	// Test org admin owns Helping Hands
	await upsertMember(helpingHands.id, testOrgAdmin.id, Role.OWNER);
	// Also give them access to Green City as ADMIN for multi-org testing
	await upsertMember(greenCity.id, testOrgAdmin.id, Role.ADMIN);

	// Test volunteer gets a profile but no org membership
	await upsertProfile(testVolunteer.id, {
		bio: 'Test volunteer account for dev/staging. Has a complete profile.',
		phone: '(555) 000-0001',
		city: 'Portland',
		state: 'OR',
		country: 'US',
		availability: 'FLEXIBLE',
		visibility: 'PUBLIC',
		interests: ['testing', 'development'],
	});

	// =========================================================================
	// 4. Staff / Org users
	// =========================================================================
	console.log('👥 Creating org staff...');

	// --- Helping Hands staff ---
	const sarah = await upsertUser(
		'sarah.chen@helpinghands.example',
		'Sarah Chen',
		'https://i.pravatar.cc/150?u=sarah',
	);
	const marcus = await upsertUser(
		'marcus.johnson@helpinghands.example',
		'Marcus Johnson',
		'https://i.pravatar.cc/150?u=marcus',
	);
	const priya = await upsertUser(
		'priya.patel@helpinghands.example',
		'Priya Patel',
		'https://i.pravatar.cc/150?u=priya',
	);
	const tom = await upsertUser('tom.wright@helpinghands.example', 'Tom Wright');

	await upsertMember(helpingHands.id, sarah.id, Role.OWNER);
	await upsertMember(helpingHands.id, marcus.id, Role.ADMIN);
	await upsertMember(helpingHands.id, priya.id, Role.STAFF);
	await upsertMember(helpingHands.id, tom.id, Role.READONLY);

	// --- Green City Parks staff ---
	const elena = await upsertUser(
		'elena.vasquez@greencityparks.example',
		'Elena Vasquez',
		'https://i.pravatar.cc/150?u=elena',
	);
	const james = await upsertUser('james.ko@greencityparks.example', 'James Ko');

	await upsertMember(greenCity.id, elena.id, Role.OWNER);
	await upsertMember(greenCity.id, james.id, Role.STAFF);
	// Marcus also helps at Green City (multi-org)
	await upsertMember(greenCity.id, marcus.id, Role.ADMIN);

	// --- Youth Futures staff ---
	const diana = await upsertUser(
		'diana.okafor@youthfutures.example',
		'Diana Okafor',
		'https://i.pravatar.cc/150?u=diana',
	);

	await upsertMember(youthFutures.id, diana.id, Role.OWNER);

	// --- Dev org ---
	const devAdmin = await upsertUser('admin@volunteermatch.local', 'Dev Admin');
	await upsertMember(devOrg.id, devAdmin.id, Role.OWNER);

	// =========================================================================
	// 5. Pure volunteers (10 users, no org membership)
	// =========================================================================
	console.log('🙋 Creating volunteers...');

	const vol1 = await upsertUser(
		'alex.rivera@example.com',
		'Alex Rivera',
		'https://i.pravatar.cc/150?u=alex',
	);
	const vol2 = await upsertUser(
		'jordan.lee@example.com',
		'Jordan Lee',
		'https://i.pravatar.cc/150?u=jordan',
	);
	const vol3 = await upsertUser(
		'maya.thompson@example.com',
		'Maya Thompson',
		'https://i.pravatar.cc/150?u=maya',
	);
	const vol4 = await upsertUser('sam.nguyen@example.com', 'Sam Nguyen');
	const vol5 = await upsertUser(
		'olivia.martinez@example.com',
		'Olivia Martinez',
		'https://i.pravatar.cc/150?u=olivia',
	);
	const vol6 = await upsertUser('liam.chen@example.com', 'Liam Chen');
	const vol7 = await upsertUser(
		'ava.jackson@example.com',
		'Ava Jackson',
		'https://i.pravatar.cc/150?u=ava',
	);
	// biome-ignore lint/correctness/noUnusedVariables: seeded for data completeness
	const vol8 = await upsertUser('noah.williams@example.com', 'Noah Williams');
	const vol9 = await upsertUser(
		'emma.garcia@example.com',
		'Emma Garcia',
		'https://i.pravatar.cc/150?u=emma',
	);
	// biome-ignore lint/correctness/noUnusedVariables: seeded for data completeness
	const vol10 = await upsertUser('ethan.brown@example.com', 'Ethan Brown');

	// =========================================================================
	// 6. Volunteer profiles (varying completeness)
	// =========================================================================
	console.log('📝 Creating volunteer profiles...');

	// COMPLETE profiles
	await upsertProfile(vol1.id, {
		bio: 'Experienced community organizer with 5 years of volunteer coordination. Passionate about food security and neighborhood engagement.',
		phone: '(555) 123-4567',
		city: 'Portland',
		state: 'OR',
		country: 'US',
		availability: 'FLEXIBLE',
		visibility: 'PUBLIC',
		interests: ['food security', 'community organizing', 'event planning'],
	});
	await upsertProfile(vol2.id, {
		bio: 'Software developer who loves giving back. Skilled in web development and teaching coding workshops for underserved youth.',
		phone: '(555) 234-5678',
		city: 'Seattle',
		state: 'WA',
		country: 'US',
		availability: 'WEEKENDS',
		visibility: 'PUBLIC',
		interests: ['education', 'technology', 'mentoring'],
	});
	await upsertProfile(vol5.id, {
		bio: 'Retired nurse looking to stay active and help the community. Fluent in English and Spanish.',
		phone: '(555) 567-8901',
		city: 'Austin',
		state: 'TX',
		country: 'US',
		availability: 'WEEKDAYS',
		visibility: 'PUBLIC',
		interests: ['healthcare', 'elderly care', 'translation'],
	});

	// STRONG profiles (missing one or two fields)
	await upsertProfile(vol3.id, {
		bio: 'Environmental science student eager to contribute to conservation projects.',
		city: 'Denver',
		state: 'CO',
		country: 'US',
		availability: 'WEEKENDS',
		visibility: 'ORGS_ONLY',
		interests: ['environment', 'conservation', 'wildlife'],
	});
	await upsertProfile(vol7.id, {
		bio: 'Professional photographer offering skills for nonprofit events and campaigns.',
		phone: '(555) 789-0123',
		city: 'San Francisco',
		state: 'CA',
		country: 'US',
		availability: 'EVENINGS',
		visibility: 'PUBLIC',
		interests: ['photography', 'arts', 'marketing'],
	});

	// BASIC profiles (just location or bio)
	await upsertProfile(vol4.id, {
		city: 'Chicago',
		state: 'IL',
		country: 'US',
		availability: 'FLEXIBLE',
		visibility: 'ORGS_ONLY',
	});
	await upsertProfile(vol9.id, {
		bio: 'College student looking for meaningful volunteer work.',
		availability: 'EVENINGS',
		visibility: 'ORGS_ONLY',
		interests: ['education'],
	});

	// =========================================================================
	// 7. Volunteer skills
	// =========================================================================
	console.log('🛠️  Adding volunteer skills...');

	await upsertSkills(
		vol1.id,
		['event-planning', 'public-speaking', 'first-aid-cpr', 'spanish'],
		skillBySlug,
	);
	await upsertSkills(
		vol2.id,
		['javascript', 'teaching', 'python'],
		skillBySlug,
	);
	await upsertSkills(
		vol3.id,
		['community-outreach', 'grant-writing'],
		skillBySlug,
	);
	await upsertSkills(vol4.id, ['volunteer-coordination'], skillBySlug);
	await upsertSkills(
		vol5.id,
		['first-aid-cpr', 'spanish', 'patient-care', 'teaching'],
		skillBySlug,
	);
	await upsertSkills(
		vol7.id,
		['photography', 'videography', 'graphic-design', 'social-media-management'],
		skillBySlug,
	);
	await upsertSkills(vol9.id, ['tutoring', 'copywriting'], skillBySlug);

	// Test volunteer gets some skills too
	await upsertSkills(
		testVolunteer.id,
		['javascript', 'typescript', 'event-planning'],
		skillBySlug,
	);

	// =========================================================================
	// 8. Screener questions per org
	// =========================================================================
	console.log('📋 Creating screener questions...');

	// --- Helping Hands: community services screening ---
	const hhQuestions: SeedQuestion[] = [
		{
			key: 'age_18_plus',
			prompt: 'Are you 18 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Must be 18+.',
				},
			},
		},
		{
			key: 'background_check_consent',
			prompt: 'Do you consent to a background check?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Background check consent is required.',
				},
			},
		},
		{
			key: 'hours_per_week',
			prompt: 'How many hours per week can you commit?',
			type: 'NUMBER',
			order: 30,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					reviewIf: { operator: 'lt', value: 4 },
					reason: 'Less than 4 hours/week may not meet minimum requirements.',
				},
			},
		},
		{
			key: 'experience_level',
			prompt: 'What is your volunteer experience level?',
			type: 'SINGLE_CHOICE',
			order: 40,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'None — this is my first time',
					'Some experience (1–2 years)',
					'Experienced (3+ years)',
				],
			},
		},
		{
			key: 'why_volunteer',
			prompt: 'Why do you want to volunteer with Helping Hands?',
			type: 'TEXT',
			order: 50,
			isActive: true,
			configJson: { required: true, maxLength: 500 },
		},
		{
			key: 'special_skills',
			prompt: 'Select any special skills you have:',
			type: 'MULTI_CHOICE',
			order: 60,
			isActive: true,
			configJson: {
				required: false,
				options: [
					'First Aid/CPR',
					'Food Handling',
					'Driving',
					'Teaching/Tutoring',
					'Construction/Repair',
					'Language Translation',
				],
			},
		},
	];
	await upsertQuestions(helpingHands.id, hhQuestions);

	// --- Green City Parks: simpler screening ---
	const gcQuestions: SeedQuestion[] = [
		{
			key: 'age_16_plus',
			prompt: 'Are you 16 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Must be 16 or older.',
				},
			},
		},
		{
			key: 'physical_activity',
			prompt:
				'Can you perform moderate physical activity outdoors for up to 4 hours?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: { required: true },
		},
		{
			key: 'interests',
			prompt: 'What park activities interest you?',
			type: 'MULTI_CHOICE',
			order: 30,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'Trail maintenance',
					'Planting & gardening',
					'Guided tours',
					'Wildlife monitoring',
					'Event setup',
				],
			},
		},
		{
			key: 'why_parks',
			prompt: 'Why do you want to help at Green City Parks?',
			type: 'TEXT',
			order: 40,
			isActive: true,
			configJson: { required: true, maxLength: 300 },
		},
	];
	await upsertQuestions(greenCity.id, gcQuestions);

	// --- Youth Futures: mentoring screening ---
	const yfQuestions: SeedQuestion[] = [
		{
			key: 'age_21_plus',
			prompt: 'Are you 21 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Mentors must be at least 21.',
				},
			},
		},
		{
			key: 'background_check_consent',
			prompt:
				'Do you consent to an enhanced background check (required for working with minors)?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Enhanced background check is mandatory for youth programs.',
				},
			},
		},
		{
			key: 'mentor_experience',
			prompt: 'Do you have prior experience mentoring or working with youth?',
			type: 'SINGLE_CHOICE',
			order: 30,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'No experience',
					'Informal (coaching, tutoring)',
					'Professional (teaching, counseling)',
				],
			},
		},
		{
			key: 'commitment_months',
			prompt: 'How many months can you commit to the mentoring program?',
			type: 'NUMBER',
			order: 40,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					reviewIf: { operator: 'lt', value: 6 },
					reason: 'Program ideally requires 6+ month commitment.',
				},
			},
		},
		{
			key: 'personal_statement',
			prompt: 'Tell us about yourself and why you want to mentor.',
			type: 'TEXT',
			order: 50,
			isActive: true,
			configJson: { required: true, maxLength: 600 },
		},
	];
	await upsertQuestions(youthFutures.id, yfQuestions);

	// Dev org keeps its original questions
	const devQuestions: SeedQuestion[] = [
		{
			key: 'age_18_plus',
			prompt: 'Are you 18 years or older?',
			type: 'BOOLEAN',
			order: 10,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Must be 18+.',
				},
			},
		},
		{
			key: 'reliable_transportation',
			prompt:
				'Do you have reliable transportation to get to the rescue location?',
			type: 'BOOLEAN',
			order: 20,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Reliable transportation is required.',
				},
			},
		},
		{
			key: 'follow_instructions',
			prompt:
				'Can you follow written and verbal instructions exactly (including safety protocols)?',
			type: 'BOOLEAN',
			order: 30,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Safety requires strict instruction-following.',
				},
			},
		},
		{
			key: 'lift_30_lbs',
			prompt: 'Are you able to lift and carry 30 pounds safely?',
			type: 'BOOLEAN',
			order: 40,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'This role requires lifting up to 30 lbs.',
				},
			},
		},
		{
			key: 'allergies',
			prompt:
				'Do you have allergies to cats or dogs that would limit volunteering?',
			type: 'SINGLE_CHOICE',
			order: 50,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'No allergies',
					'Mild allergies (manageable)',
					'Severe allergies',
				],
				rules: {
					reviewIf: { operator: 'equals', value: 'Severe allergies' },
					reason: 'May require role adjustments or accommodation.',
				},
			},
		},
		{
			key: 'comfort_reactive_animals',
			prompt:
				'How comfortable are you working around anxious or reactive animals?',
			type: 'SINGLE_CHOICE',
			order: 60,
			isActive: true,
			configJson: {
				required: true,
				options: [
					'Not comfortable',
					'Somewhat comfortable',
					'Comfortable',
					'Very comfortable',
				],
				rules: {
					reviewIf: { operator: 'equals', value: 'Not comfortable' },
					reason: 'May be better suited to non-handling roles initially.',
				},
			},
		},
		{
			key: 'why_volunteer',
			prompt: 'Why do you want to volunteer with us?',
			type: 'TEXT',
			order: 70,
			isActive: true,
			configJson: { required: true, maxLength: 400 },
		},
		{
			key: 'attest_no_abuse',
			prompt: 'I confirm I have no history of animal abuse or neglect.',
			type: 'BOOLEAN',
			order: 80,
			isActive: true,
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Cannot proceed without this attestation.',
				},
			},
		},
	];
	await upsertQuestions(devOrg.id, devQuestions);

	// =========================================================================
	// 9. Volunteer Opportunities
	// =========================================================================
	console.log('🎯 Creating volunteer opportunities...');

	// Skill ID helpers
	// biome-ignore lint/style/noNonNullAssertion: catalog was just seeded above
	const s = (slug: string) => skillBySlug.get(slug)!;
	// biome-ignore lint/style/noNonNullAssertion: catalog was just seeded above
	const f = (slug: string) => familyBySlug.get(slug)!;

	// Helping Hands opportunities
	const hhFoodBank = await createOpportunityIfNotExists({
		orgId: helpingHands.id,
		title: 'Community Food Bank — Weekly Sorting',
		description:
			'Help sort and distribute donated food items at our downtown warehouse every Saturday morning. Great for groups and individuals alike.',
		status: 'PUBLISHED',
		location: '1200 Main St, Portland, OR 97201',
		startDate: daysFromNow(3),
		endDate: daysFromNow(90),
		commitmentHours: 4,
		capacity: 20,
		tags: ['food security', 'warehouse', 'weekly'],
		requirements: [
			{ skillId: s('volunteer-coordination'), level: 'PREFERRED' },
		],
	});

	const hhTutoring = await createOpportunityIfNotExists({
		orgId: helpingHands.id,
		title: 'After-School Tutoring Program',
		description:
			'Tutor K-8 students in reading and math at partner schools across the metro area. Training provided. Background check required.',
		status: 'PUBLISHED',
		location: 'Various schools — Portland metro',
		startDate: daysFromNow(7),
		endDate: daysFromNow(180),
		commitmentHours: 6,
		capacity: 15,
		tags: ['education', 'youth', 'tutoring'],
		requirements: [
			{ skillId: s('teaching'), level: 'REQUIRED' },
			{ skillId: s('first-aid-cpr'), level: 'PREFERRED' },
		],
	});

	const hhMealDelivery = await createOpportunityIfNotExists({
		orgId: helpingHands.id,
		title: 'Meals on Wheels Delivery Driver',
		description:
			'Deliver hot meals to homebound seniors on weekday mornings. Must have a valid license and reliable vehicle.',
		status: 'PUBLISHED',
		location: 'Portland metro area',
		startDate: daysFromNow(1),
		endDate: daysFromNow(365),
		commitmentHours: 3,
		capacity: 10,
		tags: ['elderly care', 'driving', 'daily'],
		requirements: [
			{ skillId: s('senior-care'), level: 'REQUIRED' },
			{ skillId: s('spanish'), level: 'PREFERRED' },
		],
	});

	const hhWebsite = await createOpportunityIfNotExists({
		orgId: helpingHands.id,
		title: 'Website Redesign Project',
		description:
			'Help redesign our nonprofit website. Remote-friendly, looking for web developers and designers.',
		status: 'DRAFT',
		isRemote: true,
		commitmentHours: 10,
		capacity: 5,
		tags: ['technology', 'remote', 'design'],
		requirements: [
			{ familyId: f('programming-development'), level: 'REQUIRED' },
			{ skillId: s('graphic-design'), level: 'PREFERRED' },
		],
	});

	const hhGala = await createOpportunityIfNotExists({
		orgId: helpingHands.id,
		title: 'Annual Fundraiser Gala — Event Volunteers',
		description:
			'Help set up, run, and tear down our annual fundraiser gala. One-time commitment on April 15th.',
		status: 'PUBLISHED',
		location: 'Portland Convention Center',
		startDate: daysFromNow(35),
		endDate: daysFromNow(35),
		commitmentHours: 8,
		capacity: 30,
		tags: ['events', 'fundraising', 'one-time'],
		requirements: [
			{ skillId: s('event-planning'), level: 'PREFERRED' },
			{ skillId: s('public-speaking'), level: 'PREFERRED' },
		],
	});

	// Green City Parks opportunities
	const gcTrail = await createOpportunityIfNotExists({
		orgId: greenCity.id,
		title: 'Spring Trail Restoration',
		description:
			'Join us for hands-on trail work including erosion repair, bridge building, and signage installation across 12 miles of trails.',
		status: 'PUBLISHED',
		location: 'Forest Park, Portland, OR',
		startDate: daysFromNow(10),
		endDate: daysFromNow(60),
		commitmentHours: 6,
		capacity: 25,
		tags: ['outdoors', 'trails', 'conservation'],
	});

	// biome-ignore lint/correctness/noUnusedVariables: seeded for data completeness
	const gcGarden = await createOpportunityIfNotExists({
		orgId: greenCity.id,
		title: 'Community Garden Coordinator',
		description:
			'Lead a team of volunteers at the Riverside Community Garden. Manage planting schedules, tool inventory, and plot assignments.',
		status: 'PUBLISHED',
		location: 'Riverside Park, Portland, OR',
		startDate: daysFromNow(5),
		endDate: daysFromNow(120),
		commitmentHours: 8,
		tags: ['gardening', 'leadership', 'community'],
		requirements: [{ skillId: s('volunteer-coordination'), level: 'REQUIRED' }],
	});

	const gcWildlife = await createOpportunityIfNotExists({
		orgId: greenCity.id,
		title: 'Bird Census & Wildlife Monitoring',
		description:
			'Monthly bird counts and wildlife observation walks. Training provided by local Audubon chapter.',
		status: 'PUBLISHED',
		isRemote: false,
		location: 'Various parks',
		startDate: daysFromNow(14),
		endDate: daysFromNow(365),
		commitmentHours: 3,
		tags: ['wildlife', 'research', 'outdoors'],
		requirements: [
			{ skillId: s('photography'), level: 'PREFERRED' },
			{ skillId: s('database-management'), level: 'PREFERRED' },
		],
	});

	// biome-ignore lint/correctness/noUnusedVariables: seeded for data completeness
	const gcClosed = await createOpportunityIfNotExists({
		orgId: greenCity.id,
		title: 'Winter Cleanup 2025',
		description:
			'Annual winter cleanup — this event has concluded. Thanks to all 50 volunteers who participated!',
		status: 'CLOSED',
		location: 'Forest Park',
		startDate: daysAgo(90),
		endDate: daysAgo(89),
		commitmentHours: 5,
		capacity: 50,
		tags: ['cleanup', 'seasonal'],
	});

	// Youth Futures — just one to keep it sparse (new org)
	const yfMentor = await createOpportunityIfNotExists({
		orgId: youthFutures.id,
		title: 'One-on-One Youth Mentor',
		description:
			'Be matched with a young person (ages 12–17) and meet weekly for academic support, career exploration, and personal development.',
		status: 'PUBLISHED',
		location: 'Various community centers — Portland',
		startDate: daysFromNow(14),
		endDate: daysFromNow(365),
		commitmentHours: 3,
		capacity: 20,
		tags: ['mentoring', 'youth', 'education'],
		requirements: [
			{ skillId: s('teaching'), level: 'PREFERRED' },
			{ skillId: s('public-speaking'), level: 'PREFERRED' },
		],
	});

	// Riverside Animal Shelter (devOrg) — shelter-vertical marketing screenshot
	// (issue #139 PR3). Reuses the org's existing shelter-flavored screener
	// questions/applications; these are the only opportunities it needed.
	const rasDogWalking = await createOpportunityIfNotExists({
		orgId: devOrg.id,
		title: 'Dog Walking & Enrichment',
		description:
			'Walk and socialize shelter dogs, run enrichment activities, and help reduce kennel stress. Comfort with reactive animals preferred but not required — roles are matched to your comfort level.',
		status: 'PUBLISHED',
		location: 'Riverside Animal Shelter — main campus',
		startDate: daysFromNow(5),
		endDate: daysFromNow(180),
		commitmentHours: 3,
		capacity: 25,
		tags: ['animal handling', 'dogs', 'enrichment'],
	});
	await createOpportunityIfNotExists({
		orgId: devOrg.id,
		title: 'Front Desk & Adoption Support',
		description:
			'Greet visitors, help match adopters with the right animal, and support paperwork during adoption events. No animal handling required.',
		status: 'PUBLISHED',
		location: 'Riverside Animal Shelter — front desk',
		startDate: daysFromNow(10),
		endDate: daysFromNow(180),
		commitmentHours: 4,
		capacity: 15,
		tags: ['front desk', 'adoption events', 'customer service'],
	});

	// =========================================================================
	// 10. Applications
	// =========================================================================
	console.log('📨 Creating applications...');

	// Helping Hands applications
	await createApplicationIfNotExists({
		orgId: helpingHands.id,
		submittedByEmail: vol1.email ?? '',
		submittedByUserId: vol1.id,
		opportunityId: hhFoodBank.id,
		status: 'APPROVED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'hours_per_week', value: 8 },
			{ questionKey: 'experience_level', value: 'Experienced (3+ years)' },
			{
				questionKey: 'why_volunteer',
				value:
					'I have been volunteering for years in food security. I want to contribute my organizational skills to the food bank.',
			},
			{
				questionKey: 'special_skills',
				value: ['First Aid/CPR', 'Food Handling', 'Driving'],
			},
		],
	});

	await createApplicationIfNotExists({
		orgId: helpingHands.id,
		submittedByEmail: vol2.email ?? '',
		submittedByUserId: vol2.id,
		opportunityId: hhWebsite.id,
		status: 'SUBMITTED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'hours_per_week', value: 10 },
			{ questionKey: 'experience_level', value: 'Some experience (1–2 years)' },
			{
				questionKey: 'why_volunteer',
				value:
					'I am a web developer and would love to help redesign your site pro bono.',
			},
			{ questionKey: 'special_skills', value: [] },
		],
	});

	await createApplicationIfNotExists({
		orgId: helpingHands.id,
		submittedByEmail: vol5.email ?? '',
		submittedByUserId: vol5.id,
		opportunityId: hhMealDelivery.id,
		status: 'APPROVED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'hours_per_week', value: 12 },
			{ questionKey: 'experience_level', value: 'Experienced (3+ years)' },
			{
				questionKey: 'why_volunteer',
				value:
					'As a retired nurse, I care deeply about seniors. I am bilingual and can help Spanish-speaking clients.',
			},
			{
				questionKey: 'special_skills',
				value: ['First Aid/CPR', 'Driving', 'Language Translation'],
			},
		],
	});

	await createApplicationIfNotExists({
		orgId: helpingHands.id,
		submittedByEmail: vol9.email ?? '',
		submittedByUserId: vol9.id,
		status: 'REVIEW',
		screeningStatus: 'REVIEW',
		screeningReasons: [
			{
				code: 'LOW_HOURS',
				message: 'Less than 4 hours/week may not meet minimum requirements.',
			},
		],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'hours_per_week', value: 2 },
			{
				questionKey: 'experience_level',
				value: 'None — this is my first time',
			},
			{
				questionKey: 'why_volunteer',
				value: 'I want to give back to my community while in college.',
			},
			{ questionKey: 'special_skills', value: ['Teaching/Tutoring'] },
		],
	});

	await createApplicationIfNotExists({
		orgId: helpingHands.id,
		submittedByEmail: 'underage-applicant@example.com',
		status: 'REJECTED',
		screeningStatus: 'FAIL',
		screeningReasons: [
			{ code: 'UNDER_18', message: 'Must be 18 years or older.' },
		],
		answers: [
			{ questionKey: 'age_18_plus', value: false },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'hours_per_week', value: 5 },
			{
				questionKey: 'experience_level',
				value: 'None — this is my first time',
			},
			{
				questionKey: 'why_volunteer',
				value: 'I need volunteer hours for school.',
			},
			{ questionKey: 'special_skills', value: [] },
		],
	});

	// Green City Parks applications
	await createApplicationIfNotExists({
		orgId: greenCity.id,
		submittedByEmail: vol3.email ?? '',
		submittedByUserId: vol3.id,
		opportunityId: gcWildlife.id,
		status: 'APPROVED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_16_plus', value: true },
			{ questionKey: 'physical_activity', value: true },
			{
				questionKey: 'interests',
				value: ['Wildlife monitoring', 'Trail maintenance'],
			},
			{
				questionKey: 'why_parks',
				value:
					'I am studying environmental science and want hands-on conservation experience.',
			},
		],
	});

	await createApplicationIfNotExists({
		orgId: greenCity.id,
		submittedByEmail: vol4.email ?? '',
		submittedByUserId: vol4.id,
		opportunityId: gcTrail.id,
		status: 'SUBMITTED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_16_plus', value: true },
			{ questionKey: 'physical_activity', value: true },
			{ questionKey: 'interests', value: ['Trail maintenance'] },
			{
				questionKey: 'why_parks',
				value: 'I enjoy being outdoors and working with my hands.',
			},
		],
	});

	// Youth Futures applications
	await createApplicationIfNotExists({
		orgId: youthFutures.id,
		submittedByEmail: vol5.email ?? '',
		submittedByUserId: vol5.id,
		opportunityId: yfMentor.id,
		status: 'SUBMITTED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_21_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{
				questionKey: 'mentor_experience',
				value: 'Professional (teaching, counseling)',
			},
			{ questionKey: 'commitment_months', value: 12 },
			{
				questionKey: 'personal_statement',
				value:
					'I spent 30 years as a pediatric nurse. Now retired, I want to mentor young people who need guidance navigating career choices and personal challenges.',
			},
		],
	});

	await createApplicationIfNotExists({
		orgId: youthFutures.id,
		submittedByEmail: vol6.email ?? '',
		submittedByUserId: vol6.id,
		status: 'REVIEW',
		screeningStatus: 'REVIEW',
		screeningReasons: [
			{
				code: 'SHORT_COMMITMENT',
				message: 'Program ideally requires 6+ month commitment.',
			},
		],
		answers: [
			{ questionKey: 'age_21_plus', value: true },
			{ questionKey: 'background_check_consent', value: true },
			{ questionKey: 'mentor_experience', value: 'No experience' },
			{ questionKey: 'commitment_months', value: 3 },
			{
				questionKey: 'personal_statement',
				value: 'I want to try mentoring and see if it is a good fit for me.',
			},
		],
	});

	// Dev org — keep legacy seed apps
	await createApplicationIfNotExists({
		orgId: devOrg.id,
		opportunityId: rasDogWalking.id,
		submittedByEmail: 'sample-pass@volunteermatch.local',
		submittedByUserId: testVolunteer.id,
		status: 'SUBMITTED',
		screeningStatus: 'PASS',
		screeningReasons: [],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'reliable_transportation', value: true },
			{ questionKey: 'follow_instructions', value: true },
			{ questionKey: 'lift_30_lbs', value: true },
			{ questionKey: 'allergies', value: 'No allergies' },
			{ questionKey: 'comfort_reactive_animals', value: 'Comfortable' },
			{
				questionKey: 'why_volunteer',
				value:
					'I love animals and I am consistent. Happy to start with cleaning, feeding, and basic support tasks.',
			},
			{ questionKey: 'attest_no_abuse', value: true },
		],
	});

	await createApplicationIfNotExists({
		orgId: devOrg.id,
		opportunityId: rasDogWalking.id,
		submittedByEmail: 'sample-review@volunteermatch.local',
		status: 'REVIEW',
		screeningStatus: 'REVIEW',
		screeningReasons: [
			{
				code: 'ALLERGIES_SEVERE',
				message: 'Severe allergies may require role adjustments.',
			},
			{
				code: 'REACTIVE_COMFORT_LOW',
				message:
					'Not comfortable with reactive animals; consider non-handling roles.',
			},
		],
		answers: [
			{ questionKey: 'age_18_plus', value: true },
			{ questionKey: 'reliable_transportation', value: true },
			{ questionKey: 'follow_instructions', value: true },
			{ questionKey: 'lift_30_lbs', value: true },
			{ questionKey: 'allergies', value: 'Severe allergies' },
			{ questionKey: 'comfort_reactive_animals', value: 'Not comfortable' },
			{
				questionKey: 'why_volunteer',
				value:
					'I want to help but I am new. I am open to admin tasks, laundry, food prep, and cleaning.',
			},
			{ questionKey: 'attest_no_abuse', value: true },
		],
	});

	await createApplicationIfNotExists({
		orgId: devOrg.id,
		opportunityId: rasDogWalking.id,
		submittedByEmail: 'sample-fail@volunteermatch.local',
		status: 'REJECTED',
		screeningStatus: 'FAIL',
		screeningReasons: [
			{ code: 'UNDER_18', message: 'Must be 18 years or older.' },
		],
		answers: [
			{ questionKey: 'age_18_plus', value: false },
			{ questionKey: 'reliable_transportation', value: true },
			{ questionKey: 'follow_instructions', value: true },
			{ questionKey: 'lift_30_lbs', value: true },
			{ questionKey: 'allergies', value: 'No allergies' },
			{
				questionKey: 'comfort_reactive_animals',
				value: 'Somewhat comfortable',
			},
			{
				questionKey: 'why_volunteer',
				value: 'I need volunteer hours for school.',
			},
			{ questionKey: 'attest_no_abuse', value: true },
		],
	});

	// =========================================================================
	// 11. Shifts & Signups
	// =========================================================================
	console.log('📅 Creating shifts & signups...');

	// Upcoming shifts
	const satFoodBank = await createShiftIfNotExists({
		orgId: helpingHands.id,
		opportunityId: hhFoodBank.id,
		title: 'Saturday Food Sort — Morning',
		description: 'Sort and pack donated groceries for distribution.',
		location: '1200 Main St, Portland, OR 97201',
		startTime: daysFromNow(5),
		endTime: hoursFromNow(5 * 24 + 4),
		capacity: 10,
		status: 'OPEN',
	});

	const satFoodBankAfternoon = await createShiftIfNotExists({
		orgId: helpingHands.id,
		opportunityId: hhFoodBank.id,
		title: 'Saturday Food Sort — Afternoon',
		location: '1200 Main St, Portland, OR 97201',
		startTime: hoursFromNow(5 * 24 + 5),
		endTime: hoursFromNow(5 * 24 + 9),
		capacity: 8,
		status: 'OPEN',
	});

	const tutoringShift = await createShiftIfNotExists({
		orgId: helpingHands.id,
		opportunityId: hhTutoring.id,
		title: 'Tuesday Tutoring — Lincoln Elementary',
		location: 'Lincoln Elementary, Portland, OR',
		startTime: daysFromNow(8),
		endTime: hoursFromNow(8 * 24 + 3),
		capacity: 5,
		status: 'OPEN',
	});

	const galaSetup = await createShiftIfNotExists({
		orgId: helpingHands.id,
		opportunityId: hhGala.id,
		title: 'Gala Setup Crew',
		location: 'Portland Convention Center',
		startTime: daysFromNow(35),
		endTime: hoursFromNow(35 * 24 + 4),
		capacity: 15,
		status: 'OPEN',
	});

	const trailDay = await createShiftIfNotExists({
		orgId: greenCity.id,
		opportunityId: gcTrail.id,
		title: 'Trail Work Day — Section A',
		location: 'Forest Park Trailhead #3',
		startTime: daysFromNow(12),
		endTime: hoursFromNow(12 * 24 + 6),
		capacity: 12,
		status: 'OPEN',
	});

	// Past/completed shifts
	const pastCleanup = await createShiftIfNotExists({
		orgId: greenCity.id,
		title: 'Winter Cleanup Shift',
		location: 'Forest Park',
		startTime: daysAgo(90),
		endTime: daysAgo(90),
		capacity: 25,
		status: 'COMPLETED',
	});

	// Cancelled shift
	const cancelledShift = await createShiftIfNotExists({
		orgId: helpingHands.id,
		title: 'Wednesday Meal Delivery (Cancelled — Weather)',
		location: 'Portland metro',
		startTime: daysFromNow(2),
		endTime: hoursFromNow(2 * 24 + 3),
		capacity: 5,
		status: 'CANCELLED',
	});

	// Full shift
	const fullShift = await createShiftIfNotExists({
		orgId: helpingHands.id,
		opportunityId: hhFoodBank.id,
		title: 'Friday Evening Restock',
		location: '1200 Main St, Portland, OR 97201',
		startTime: daysFromNow(4),
		endTime: hoursFromNow(4 * 24 + 3),
		capacity: 2,
		status: 'FULL',
	});

	// Signups
	await createSignupIfNotExists(satFoodBank.id, vol1.id, 'CONFIRMED');
	await createSignupIfNotExists(satFoodBank.id, vol5.id, 'CONFIRMED');
	await createSignupIfNotExists(satFoodBank.id, vol4.id, 'CONFIRMED');
	await createSignupIfNotExists(satFoodBankAfternoon.id, vol1.id, 'CONFIRMED');
	await createSignupIfNotExists(tutoringShift.id, vol2.id, 'CONFIRMED');
	await createSignupIfNotExists(tutoringShift.id, vol5.id, 'CONFIRMED');
	await createSignupIfNotExists(galaSetup.id, vol1.id, 'CONFIRMED');
	await createSignupIfNotExists(
		galaSetup.id,
		vol7.id,
		'CONFIRMED',
		'Happy to photograph the event too!',
	);
	await createSignupIfNotExists(trailDay.id, vol3.id, 'CONFIRMED');
	await createSignupIfNotExists(trailDay.id, vol4.id, 'CONFIRMED');

	// Past shift attendance
	await createSignupIfNotExists(pastCleanup.id, vol3.id, 'ATTENDED');
	await createSignupIfNotExists(pastCleanup.id, vol4.id, 'NO_SHOW');

	// Full shift signups
	await createSignupIfNotExists(fullShift.id, vol1.id, 'CONFIRMED');
	await createSignupIfNotExists(fullShift.id, vol5.id, 'CONFIRMED');

	// Cancelled signups
	await createSignupIfNotExists(
		cancelledShift.id,
		vol5.id,
		'CANCELLED',
		'Shift cancelled due to weather.',
	);

	// =========================================================================
	// 12. Credentials
	// =========================================================================
	console.log('🏅 Creating credentials...');

	// Test volunteer — verified credentials so the profile Credentials tab has
	// real data (marketing screenshot capture depends on this: see
	// e2e/capture-scenarios.ts `credentials` scenario)
	await upsertCredential(
		testVolunteer.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'VERIFIED',
		{
			issuedAt: daysAgo(30),
			expiresAt: daysFromNow(335),
			notes: 'Cleared — no issues.',
		},
	);
	await upsertCredential(
		testVolunteer.id,
		helpingHands.id,
		'ORIENTATION_COMPLETE',
		'VERIFIED',
		{
			issuedAt: daysAgo(25),
		},
	);
	await upsertCredential(
		testVolunteer.id,
		helpingHands.id,
		'TRAINING_COMPLETE',
		'VERIFIED',
		{
			issuedAt: daysAgo(20),
		},
	);

	// Alex — fully verified at Helping Hands
	await upsertCredential(
		vol1.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'VERIFIED',
		{
			issuedAt: daysAgo(60),
			expiresAt: daysFromNow(305),
			notes: 'Cleared — no issues.',
		},
	);
	await upsertCredential(
		vol1.id,
		helpingHands.id,
		'ORIENTATION_COMPLETE',
		'VERIFIED',
		{
			issuedAt: daysAgo(55),
		},
	);
	await upsertCredential(
		vol1.id,
		helpingHands.id,
		'TRAINING_COMPLETE',
		'VERIFIED',
		{
			issuedAt: daysAgo(50),
		},
	);

	// Olivia — background check verified, training pending
	await upsertCredential(
		vol5.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'VERIFIED',
		{
			issuedAt: daysAgo(30),
			expiresAt: daysFromNow(335),
		},
	);
	await upsertCredential(
		vol5.id,
		helpingHands.id,
		'TRAINING_COMPLETE',
		'PENDING',
	);
	await upsertCredential(vol5.id, helpingHands.id, 'ID_VERIFIED', 'VERIFIED', {
		issuedAt: daysAgo(28),
	});

	// Maya — verified at Green City Parks
	await upsertCredential(
		vol3.id,
		greenCity.id,
		'ORIENTATION_COMPLETE',
		'VERIFIED',
		{
			issuedAt: daysAgo(45),
		},
	);

	// Jordan — expired credential
	await upsertCredential(
		vol2.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'EXPIRED',
		{
			issuedAt: daysAgo(400),
			expiresAt: daysAgo(35),
			notes: 'Needs renewal.',
		},
	);

	// Ava — reference check revoked
	await upsertCredential(
		vol7.id,
		helpingHands.id,
		'REFERENCE_CHECK',
		'REVOKED',
		{
			issuedAt: daysAgo(90),
			notes: 'Reference could not be contacted.',
		},
	);

	// =========================================================================
	// 13. Credential Sharing (Phase 6C)
	// =========================================================================
	console.log('🔗 Creating credential share tokens...');

	// Alex shared his BACKGROUND_CHECK from Helping Hands -> Green City claimed it
	const alexBgCheck = await prisma.volunteerCredential.findUnique({
		where: {
			userId_orgId_type: {
				userId: vol1.id,
				orgId: helpingHands.id,
				type: 'BACKGROUND_CHECK',
			},
		},
	});

	if (alexBgCheck) {
		await prisma.credentialShareToken
			.create({
				data: {
					tokenHash: seedTokenHash('alex-bg-claimed'),
					credentialId: alexBgCheck.id,
					createdByUserId: vol1.id,
					expiresAt: daysFromNow(15),
					status: 'CLAIMED' as ShareTokenStatus,
					claimedByOrgId: greenCity.id,
					claimedAt: daysAgo(5),
				},
			})
			.catch(() => {
				/* ignore duplicate */
			});

		await upsertCredential(
			vol1.id,
			greenCity.id,
			'BACKGROUND_CHECK',
			'VERIFIED',
			{
				issuedAt: daysAgo(60),
				expiresAt: daysFromNow(305),
				notes: 'Cleared — no issues.',
				sharedFromOrgId: helpingHands.id,
				sharedFromCredentialId: alexBgCheck.id,
			},
		);
	}

	// Olivia has an active share token for her BG check (not yet claimed)
	const oliviaBgCheck = await prisma.volunteerCredential.findUnique({
		where: {
			userId_orgId_type: {
				userId: vol5.id,
				orgId: helpingHands.id,
				type: 'BACKGROUND_CHECK',
			},
		},
	});

	if (oliviaBgCheck) {
		await prisma.credentialShareToken
			.create({
				data: {
					tokenHash: seedTokenHash('olivia-bg-active'),
					credentialId: oliviaBgCheck.id,
					createdByUserId: vol5.id,
					expiresAt: daysFromNow(25),
					status: 'ACTIVE' as ShareTokenStatus,
				},
			})
			.catch(() => {
				/* ignore duplicate */
			});
	}

	// Jordan had a share token that expired
	const jordanBgCheck = await prisma.volunteerCredential.findUnique({
		where: {
			userId_orgId_type: {
				userId: vol2.id,
				orgId: helpingHands.id,
				type: 'BACKGROUND_CHECK',
			},
		},
	});

	if (jordanBgCheck) {
		await prisma.credentialShareToken
			.create({
				data: {
					tokenHash: seedTokenHash('jordan-bg-expired'),
					credentialId: jordanBgCheck.id,
					createdByUserId: vol2.id,
					expiresAt: daysAgo(10),
					status: 'EXPIRED' as ShareTokenStatus,
				},
			})
			.catch(() => {
				/* ignore duplicate */
			});
	}

	// =========================================================================
	// 14. Audit log entries
	// =========================================================================
	console.log('📜 Creating audit log entries...');

	const auditEntries = [
		{
			actorId: sarah.id,
			orgId: helpingHands.id,
			action: 'application.approved',
			entityType: 'VolunteerApplication',
			entityId: null,
			metadata: { email: vol1.email },
		},
		{
			actorId: sarah.id,
			orgId: helpingHands.id,
			action: 'opportunity.created',
			entityType: 'VolunteerOpportunity',
			entityId: hhFoodBank.id,
			metadata: { title: 'Community Food Bank — Weekly Sorting' },
		},
		{
			actorId: marcus.id,
			orgId: helpingHands.id,
			action: 'shift.created',
			entityType: 'Shift',
			entityId: satFoodBank.id,
			metadata: { title: 'Saturday Food Sort — Morning' },
		},
		{
			actorId: elena.id,
			orgId: greenCity.id,
			action: 'application.approved',
			entityType: 'VolunteerApplication',
			entityId: null,
			metadata: { email: vol3.email },
		},
		{
			actorId: elena.id,
			orgId: greenCity.id,
			action: 'opportunity.created',
			entityType: 'VolunteerOpportunity',
			entityId: gcTrail.id,
			metadata: { title: 'Spring Trail Restoration' },
		},
		{
			actorId: diana.id,
			orgId: youthFutures.id,
			action: 'opportunity.created',
			entityType: 'VolunteerOpportunity',
			entityId: yfMentor.id,
			metadata: { title: 'One-on-One Youth Mentor' },
		},
	];

	for (const entry of auditEntries) {
		await prisma.auditLog.create({
			data: {
				actorId: entry.actorId,
				orgId: entry.orgId,
				action: entry.action,
				entityType: entry.entityType,
				entityId: entry.entityId,
				metadata: entry.metadata as Prisma.InputJsonValue,
			},
		});
	}

	// =========================================================================
	// 15. Organization invitations
	// =========================================================================
	console.log('✉️  Creating organization invitations...');

	// Pending invite
	await prisma.organizationInvitation
		.create({
			data: {
				orgId: helpingHands.id,
				email: 'newstaff@helpinghands.example',
				role: Role.STAFF,
				tokenHash: 'seed-invite-token-pending-hh',
				expiresAt: daysFromNow(7),
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// Expired invite
	await prisma.organizationInvitation
		.create({
			data: {
				orgId: greenCity.id,
				email: 'expired-invite@greencityparks.example',
				role: Role.STAFF,
				tokenHash: 'seed-invite-token-expired-gc',
				expiresAt: daysAgo(5),
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// =========================================================================
	// 16. Corporate company accounts
	// =========================================================================
	console.log('🏢 Creating company accounts...');

	// Acme Corp — PRO plan, linked to Helping Hands + Green City Parks
	const acmeCorp = await prisma.companyAccount.upsert({
		where: { slug: 'acme-corp' },
		update: { name: 'Acme Corporation', planTier: 'PRO' },
		create: {
			name: 'Acme Corporation',
			slug: 'acme-corp',
			planTier: 'PRO',
		},
		select: { id: true, slug: true, name: true },
	});

	// Test company admin owns Acme Corp
	await prisma.companyMember
		.upsert({
			where: {
				companyId_userId: {
					companyId: acmeCorp.id,
					userId: testCompanyAdmin.id,
				},
			},
			update: { role: 'OWNER' },
			create: {
				companyId: acmeCorp.id,
				userId: testCompanyAdmin.id,
				role: 'OWNER',
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// Sarah Chen is also company OWNER
	await prisma.companyMember
		.upsert({
			where: {
				companyId_userId: {
					companyId: acmeCorp.id,
					userId: sarah.id,
				},
			},
			update: { role: 'OWNER' },
			create: {
				companyId: acmeCorp.id,
				userId: sarah.id,
				role: 'OWNER',
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// Marcus Johnson is company ADMIN
	await prisma.companyMember
		.upsert({
			where: {
				companyId_userId: {
					companyId: acmeCorp.id,
					userId: marcus.id,
				},
			},
			update: { role: 'ADMIN' },
			create: {
				companyId: acmeCorp.id,
				userId: marcus.id,
				role: 'ADMIN',
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// Link Acme Corp to Helping Hands and Green City Parks
	await prisma.companyNonprofitLink
		.upsert({
			where: {
				companyId_orgId: {
					companyId: acmeCorp.id,
					orgId: helpingHands.id,
				},
			},
			update: { status: 'ACTIVE' },
			create: {
				companyId: acmeCorp.id,
				orgId: helpingHands.id,
				status: 'ACTIVE',
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	await prisma.companyNonprofitLink
		.upsert({
			where: {
				companyId_orgId: {
					companyId: acmeCorp.id,
					orgId: greenCity.id,
				},
			},
			update: { status: 'ACTIVE' },
			create: {
				companyId: acmeCorp.id,
				orgId: greenCity.id,
				status: 'ACTIVE',
			},
		})
		.catch(() => {
			/* ignore duplicate */
		});

	// ESG demo activity: past ATTENDED shifts for Acme employees at linked
	// nonprofits so the ESG dashboard (and marketing screenshot) shows real
	// aggregates instead of the zero-state.
	// Fixed timestamps, NOT daysAgo(): createShiftIfNotExists matches on
	// (orgId, title, startTime), so per-run NOW arithmetic would create
	// duplicate shifts and inflate the aggregates on every seed re-run.
	console.log('📊 Creating ESG demo activity (Acme Corp)...');

	const esgFoodBankDay = await createShiftIfNotExists({
		orgId: helpingHands.id,
		title: 'Corporate Volunteer Day — Food Bank',
		location: '1200 Main St, Portland, OR 97201',
		startTime: new Date('2026-06-12T16:00:00Z'),
		endTime: new Date('2026-06-12T20:00:00Z'), // 4h
		capacity: 20,
		status: 'COMPLETED',
	});
	const esgMealPrep = await createShiftIfNotExists({
		orgId: helpingHands.id,
		title: 'Weekend Meal Prep — Team Acme',
		location: '1200 Main St, Portland, OR 97201',
		startTime: new Date('2026-06-28T17:00:00Z'),
		endTime: new Date('2026-06-28T20:00:00Z'), // 3h
		capacity: 10,
		status: 'COMPLETED',
	});
	const esgTrailDay = await createShiftIfNotExists({
		orgId: greenCity.id,
		title: 'Company Trail Restoration Day',
		location: 'Forest Park Trailhead #3',
		startTime: new Date('2026-06-21T15:00:00Z'),
		endTime: new Date('2026-06-21T20:00:00Z'), // 5h
		capacity: 15,
		status: 'COMPLETED',
	});
	const esgParkCleanup = await createShiftIfNotExists({
		orgId: greenCity.id,
		title: 'Earth Day Park Cleanup',
		location: 'Forest Park',
		startTime: new Date('2026-05-28T16:00:00Z'),
		endTime: new Date('2026-05-28T20:00:00Z'), // 4h
		capacity: 25,
		status: 'COMPLETED',
	});

	await createSignupIfNotExists(
		esgFoodBankDay.id,
		testCompanyAdmin.id,
		'ATTENDED',
	);
	await createSignupIfNotExists(esgFoodBankDay.id, sarah.id, 'ATTENDED');
	await createSignupIfNotExists(esgFoodBankDay.id, marcus.id, 'ATTENDED');
	await createSignupIfNotExists(esgMealPrep.id, sarah.id, 'ATTENDED');
	await createSignupIfNotExists(esgMealPrep.id, marcus.id, 'ATTENDED');
	await createSignupIfNotExists(esgTrailDay.id, sarah.id, 'ATTENDED');
	await createSignupIfNotExists(
		esgTrailDay.id,
		testCompanyAdmin.id,
		'ATTENDED',
	);
	await createSignupIfNotExists(esgParkCleanup.id, marcus.id, 'ATTENDED');

	// Verified credentials so the Credentials column has data
	await upsertCredential(
		sarah.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'VERIFIED',
	);
	await upsertCredential(
		marcus.id,
		helpingHands.id,
		'BACKGROUND_CHECK',
		'VERIFIED',
	);
	await upsertCredential(
		sarah.id,
		greenCity.id,
		'ORIENTATION_COMPLETE',
		'VERIFIED',
	);

	// =========================================================================
	// Done!
	// =========================================================================
	console.log('\n✅ Dev/staging seed complete!');
	console.log(
		'   Organizations: 4 (Helping Hands, Green City Parks, Youth Futures, Riverside Animal Shelter)',
	);
	console.log('   Company accounts: 1 (Acme Corporation — PRO plan)');
	console.log('   Staff users: 9');
	console.log('   Pure volunteers: 10');
	console.log('   Opportunities: 12');
	console.log('   Applications: ~12');
	console.log('   Shifts: 8');
	console.log('   Signups: ~15');
	console.log('   Credentials: 9 (includes 1 shared with provenance)');
	console.log('   Share tokens: 3 (1 claimed, 1 active, 1 expired)');
	console.log('   Audit entries: 6');
	console.log('\n🔑 Test accounts:');
	console.log(
		'   orgadmin@volunteermatch.local     — Org OWNER (Helping Hands + Green City)',
	);
	console.log(
		'   companyadmin@volunteermatch.local  — Company OWNER (Acme Corp)',
	);
	console.log('   volunteer@volunteermatch.local     — Pure volunteer');
}

// Allow running directly: ts-node prisma/seed-dev.ts
if (process.argv[1]?.endsWith('seed-dev.ts')) {
	seedDev()
		.catch((error) => {
			console.error('❌ Dev seed failed:', error);
			process.exitCode = 1;
		})
		.finally(async () => {
			await prisma.$disconnect();
		});
}

export { seedDev };
