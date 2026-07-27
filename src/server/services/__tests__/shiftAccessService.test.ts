/**
 * SECURITY tests for the org ↔ shift and org ↔ template access guards.
 *
 * These pin the two properties the guard exists for: a shift belonging to
 * another org is rejected, and its rejection is indistinguishable from a shift
 * that does not exist.
 */

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getTemplateById: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

// Required, not optional: shiftTemplateRepo imports the real prisma client at
// module load, which throws without DATABASE_URL and fails the whole suite.
vi.mock('@/server/repositories/shiftTemplateRepo', () => ({
	getTemplateById: mocks.getTemplateById,
}));

import { TRPCError } from '@trpc/server';
import {
	requireAttendanceAccess,
	requireOrgShift,
	requireOrgTemplate,
} from '../shiftAccessService';

const ORG_ID = 'org-owner';
const OTHER_ORG_ID = 'org-attacker';
const SHIFT_ID = 'shift-1';
const USER_ID = 'user-vol';

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT_ID,
		title: 'Morning Shift',
		orgId: ORG_ID,
		status: 'OPEN',
		...overrides,
	};
}

/** Resolve the TRPCError a call rejects with, failing if it resolves instead. */
async function captureError(promise: Promise<unknown>): Promise<TRPCError> {
	try {
		await promise;
	} catch (err) {
		return err as TRPCError;
	}
	throw new Error('Expected the call to reject, but it resolved.');
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('requireOrgShift', () => {
	it('returns the shift when it belongs to the org', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());

		const shift = await requireOrgShift(SHIFT_ID, ORG_ID);

		expect(shift.id).toBe(SHIFT_ID);
	});

	it('SECURITY: throws NOT_FOUND for a shift owned by another org', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());

		const err = await captureError(requireOrgShift(SHIFT_ID, OTHER_ORG_ID));

		expect(err).toBeInstanceOf(TRPCError);
		expect(err.code).toBe('NOT_FOUND');
	});

	it('SECURITY: throws NOT_FOUND — not FORBIDDEN — so "not yours" and "not real" match', async () => {
		mocks.getShiftById.mockResolvedValue(null);
		const missing = await captureError(requireOrgShift(SHIFT_ID, ORG_ID));

		mocks.getShiftById.mockResolvedValue(makeShift());
		const foreign = await captureError(requireOrgShift(SHIFT_ID, OTHER_ORG_ID));

		expect(foreign.code).toBe(missing.code);
		expect(foreign.message).toBe(missing.message);
	});
});

describe('requireAttendanceAccess', () => {
	it('staff branch delegates to the org check', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());

		const shift = await requireAttendanceAccess(SHIFT_ID, USER_ID, {
			by: 'staff',
			orgId: ORG_ID,
		});

		expect(shift.orgId).toBe(ORG_ID);
	});

	it('SECURITY: staff branch rejects a foreign shift', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());

		const err = await captureError(
			requireAttendanceAccess(SHIFT_ID, USER_ID, {
				by: 'staff',
				orgId: OTHER_ORG_ID,
			}),
		);

		expect(err.code).toBe('NOT_FOUND');
	});

	it('self branch allows a volunteer to check themselves in at any org', async () => {
		// The volunteer is not a member of the shift's org — that is the point.
		mocks.getShiftById.mockResolvedValue(makeShift());

		const shift = await requireAttendanceAccess(SHIFT_ID, USER_ID, {
			by: 'self',
			userId: USER_ID,
		});

		expect(shift.id).toBe(SHIFT_ID);
	});

	it('SECURITY: self branch rejects marking a different user', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());

		const err = await captureError(
			requireAttendanceAccess(SHIFT_ID, 'someone-else', {
				by: 'self',
				userId: USER_ID,
			}),
		);

		expect(err.code).toBe('FORBIDDEN');
	});

	it('SECURITY: self branch refuses before loading the shift', async () => {
		// A mismatched target must not even reach the database.
		mocks.getShiftById.mockResolvedValue(makeShift());

		await captureError(
			requireAttendanceAccess(SHIFT_ID, 'someone-else', {
				by: 'self',
				userId: USER_ID,
			}),
		);

		expect(mocks.getShiftById).not.toHaveBeenCalled();
	});

	it('self branch throws NOT_FOUND when the shift does not exist', async () => {
		mocks.getShiftById.mockResolvedValue(null);

		const err = await captureError(
			requireAttendanceAccess(SHIFT_ID, USER_ID, {
				by: 'self',
				userId: USER_ID,
			}),
		);

		expect(err.code).toBe('NOT_FOUND');
	});
});

describe('requireOrgTemplate', () => {
	function makeTemplate(overrides: Record<string, unknown> = {}) {
		return { id: 'tmpl-1', orgId: ORG_ID, title: 'Weekly', ...overrides };
	}

	it('returns the template when it belongs to the org', async () => {
		mocks.getTemplateById.mockResolvedValue(makeTemplate());

		const template = await requireOrgTemplate('tmpl-1', ORG_ID);

		expect(template.id).toBe('tmpl-1');
	});

	it('SECURITY: throws NOT_FOUND for a template owned by another org', async () => {
		mocks.getTemplateById.mockResolvedValue(makeTemplate());

		const err = await captureError(requireOrgTemplate('tmpl-1', OTHER_ORG_ID));

		expect(err).toBeInstanceOf(TRPCError);
		expect(err.code).toBe('NOT_FOUND');
	});

	it('SECURITY: a foreign template is indistinguishable from a missing one', async () => {
		mocks.getTemplateById.mockResolvedValue(null);
		const missing = await captureError(requireOrgTemplate('tmpl-1', ORG_ID));

		mocks.getTemplateById.mockResolvedValue(makeTemplate());
		const foreign = await captureError(
			requireOrgTemplate('tmpl-1', OTHER_ORG_ID),
		);

		expect(foreign.code).toBe(missing.code);
		expect(foreign.message).toBe(missing.message);
	});
});
