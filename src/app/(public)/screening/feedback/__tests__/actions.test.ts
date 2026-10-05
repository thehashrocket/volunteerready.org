import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type OrgRow = { id: string; suspendedAt: Date | null } | null;
const db = vi.hoisted(() => ({
	findUnique: vi.fn(
		async (_args: { where: { slug: string } }): Promise<OrgRow> => ({
			id: 'org-1',
			suspendedAt: null,
		}),
	),
	upsert: vi.fn(async (_args: unknown) => ({})),
}));
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: db.findUnique },
		orgFeedback: { upsert: db.upsert },
	},
}));
const history = vi.hoisted(() => ({
	findCurrentSlugByHistory: vi.fn(
		async (_slug: string) => null as string | null,
	),
}));
vi.mock('@/server/repositories/orgRepo', () => history);
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === 'org-feedback-token-DAY_7-riverside' && jar.token !== undefined
				? { name, value: jar.token }
				: undefined,
	}),
}));

import {
	FEEDBACK_ANSWER_MAX_LENGTH,
	INVALID_SURVEY_LINK_ERROR,
} from '@/server/domain/org-feedback';
import { generateOrgFeedbackToken } from '@/server/lib/org-feedback-token';
import { submitFeedback } from '../actions';

const SECRET = 'test-nextauth-secret';
const VALID = () => generateOrgFeedbackToken(SECRET, 'org-1', 'DAY_7');

function form(fields: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

const survey = { orgSlug: 'riverside', type: 'DAY_7' };
const answers = { working_well: 'Scheduling' };

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv('NEXTAUTH_SECRET', SECRET);
	db.findUnique.mockReset();
	db.findUnique.mockResolvedValue({ id: 'org-1', suspendedAt: null });
	db.upsert.mockReset();
	db.upsert.mockResolvedValue({});
	history.findCurrentSlugByHistory.mockReset();
	history.findCurrentSlugByHistory.mockResolvedValue(null);
	jar.token = VALID();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// Value: protects=only the emailed survey link can save an org's answers;
// fails_when=the action stops checking the cookie token against the org and
// type; why_new=the action had no tests; seam=none
describe('submitFeedback (public survey action)', () => {
	it('saves answers sent with the link emailed to that org', async () => {
		const result = await submitFeedback(form({ ...survey, ...answers }));

		expect(result).toEqual({ success: true });
		expect(db.upsert).toHaveBeenCalledOnce();
	});

	it.each([
		['no token', undefined],
		[
			'a token for another org',
			generateOrgFeedbackToken(SECRET, 'org-2', 'DAY_7'),
		],
		[
			'a token for the other survey',
			generateOrgFeedbackToken(SECRET, 'org-1', 'DAY_30'),
		],
		['a made-up token', 'deadbeef'],
	])(
		'refuses a submission with %s and saves nothing',
		async (_label, token) => {
			jar.token = token;

			const result = await submitFeedback(form({ ...survey, ...answers }));

			expect(result).toMatchObject({
				error: INVALID_SURVEY_LINK_ERROR,
			});
			expect(db.upsert).not.toHaveBeenCalled();
		},
	);

	it('does not look anything up for a token of the wrong shape', async () => {
		jar.token = 'deadbeef';

		await submitFeedback(form({ ...survey, ...answers }));

		expect(db.findUnique).not.toHaveBeenCalled();
	});

	it('gives an unknown org the same answer as a bad token', async () => {
		jar.token = generateOrgFeedbackToken(SECRET, 'org-2', 'DAY_7');
		const badToken = await submitFeedback(form({ ...survey, ...answers }));
		db.findUnique.mockResolvedValue(null);
		jar.token = VALID();
		const unknownOrg = await submitFeedback(
			form({ ...survey, orgSlug: 'nope', ...answers }),
		);

		expect(unknownOrg).toEqual(badToken);
	});

	it.each([
		['a missing org', { type: 'DAY_7' }],
		['an unknown survey type', { orgSlug: 'riverside', type: 'DAY_99' }],
		['a missing survey type', { orgSlug: 'riverside' }],
		[
			'an inherited property as the type',
			{ orgSlug: 'riverside', type: 'toString' },
		],
		['the prototype as the type', { orgSlug: 'riverside', type: '__proto__' }],
	])('refuses %s before any lookup', async (_label, fields) => {
		const result = await submitFeedback(form({ ...fields, ...answers }));

		expect(result).toEqual({ error: 'Invalid submission.' });
		expect(db.findUnique).not.toHaveBeenCalled();
	});

	// Value: protects=an emailed link keeps working after the org renames its
	// slug; fails_when=the survey only looks the org up by its current slug;
	// why_new=slug history was not consulted before; seam=none
	it('accepts a link that names the org by a slug it has since renamed', async () => {
		db.findUnique.mockImplementation(async (args) =>
			args.where.slug === 'riverside-shelter'
				? { id: 'org-1', suspendedAt: null }
				: null,
		);
		history.findCurrentSlugByHistory.mockResolvedValue('riverside-shelter');

		const result = await submitFeedback(form({ ...survey, ...answers }));

		expect(result).toEqual({ success: true });
		expect(history.findCurrentSlugByHistory).toHaveBeenCalledWith('riverside');
	});

	it('refuses a suspended org', async () => {
		db.findUnique.mockResolvedValue({ id: 'org-1', suspendedAt: new Date() });

		const result = await submitFeedback(form({ ...survey, ...answers }));

		expect(result).toMatchObject({ error: INVALID_SURVEY_LINK_ERROR });
		expect(db.upsert).not.toHaveBeenCalled();
	});

	// Value: protects=survey answers stay a bounded size; fails_when=the length
	// cap is removed; why_new=answers had no cap; seam=none
	it('refuses an answer over the length limit and saves nothing', async () => {
		const result = await submitFeedback(
			form({
				...survey,
				working_well: 'x'.repeat(FEEDBACK_ANSWER_MAX_LENGTH + 1),
			}),
		);

		expect(result).toHaveProperty('error');
		expect(db.upsert).not.toHaveBeenCalled();
	});

	it('counts a line break as one character, as the form field does', async () => {
		const lines = `${'x'.repeat(999)}\r\n${'y'.repeat(1000)}`;

		const result = await submitFeedback(
			form({ ...survey, working_well: lines }),
		);

		expect(result).toEqual({ success: true });
		expect(db.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				update: {
					responses: {
						working_well: `${'x'.repeat(999)}\n${'y'.repeat(1000)}`,
					},
				},
			}),
		);
	});

	it('refuses a survey with every answer blank', async () => {
		const result = await submitFeedback(
			form({ ...survey, working_well: '   ', expected_missing: '\n' }),
		);

		expect(result).toMatchObject({
			error: 'Please answer at least one question.',
		});
		expect(db.upsert).not.toHaveBeenCalled();
	});

	it('returns a generic message when saving fails, never the database error', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		db.upsert.mockRejectedValueOnce(
			new Error('relation "OrgFeedback" is locked'),
		);

		const result = await submitFeedback(form({ ...survey, ...answers }));

		expect(result).toMatchObject({
			error: 'Something went wrong. Please try again.',
		});
		consoleErr.mockRestore();
	});

	// Value: protects=a user's typed answers survive an error so they can fix
	// and resend; fails_when=the action stops returning the answers; why_new=
	// errors used to clear the form; seam=none
	it('returns what the user typed along with an error', async () => {
		jar.token = undefined;

		const result = await submitFeedback(
			form({ ...survey, working_well: 'Scheduling', expected_missing: 'SMS' }),
		);

		expect(result.answers).toMatchObject({
			working_well: 'Scheduling',
			expected_missing: 'SMS',
		});
	});
});
