/**
 * `isUniqueViolationOn` — the constraint name must be authoritative.
 *
 * The first version of this function took a `modelName` and returned true on a
 * model match BEFORE consulting the constraint, which made the constraint
 * argument dead at both call sites. It was safe only because `OrgVolunteer` and
 * `VolunteerApplication` each own exactly one unique index besides their primary
 * key — a fact about the schema today, pinned by nothing.
 *
 * The test that matters here is `two constraints on the SAME model`. It is the
 * case the old signature got wrong, and the case no other test covered.
 */

import { describe, expect, it } from 'vitest';
import {
	p2002Error,
	p2002WithoutAdapterMessage,
} from '@/test/prisma-error-fixtures';
import { isUniqueViolationOn } from '../prisma-errors';

const ROSTER = 'OrgVolunteer_orgId_userId_active';
const APPLICATION = 'VolunteerApplication_userId_opportunityId_active';

describe('isUniqueViolationOn', () => {
	it('matches the constraint that actually fired', () => {
		expect(isUniqueViolationOn(p2002Error(ROSTER), ROSTER)).toBe(true);
	});

	it('does not match a different constraint on a different model', () => {
		expect(isUniqueViolationOn(p2002Error('User_email_key'), ROSTER)).toBe(
			false,
		);
	});

	it('does not match a DIFFERENT constraint on the SAME model', () => {
		// The regression the rewrite exists for. A second unique index on
		// VolunteerApplication — an idempotency key on submit, or an
		// (orgId, submittedByEmail) dedupe for bulk import — would previously have
		// been reported as "You've already applied to this opportunity", which is
		// false and unactionable. No existing test caught it because they all used
		// cross-model pairs.
		const other = p2002Error(
			'VolunteerApplication_idempotencyKey_key',
			'VolunteerApplication',
		);

		expect(isUniqueViolationOn(other, APPLICATION)).toBe(false);
	});

	it('matches the primary key only when asked for the primary key', () => {
		const pk = p2002Error('VolunteerApplication_pkey', 'VolunteerApplication');

		expect(isUniqueViolationOn(pk, APPLICATION)).toBe(false);
		expect(isUniqueViolationOn(pk, 'VolunteerApplication_pkey')).toBe(true);
	});

	it('falls back to the model name when the adapter reports no message', () => {
		// Coarser by construction — it cannot tell two indexes on one table apart —
		// so it is reached only when the precise signal is unavailable.
		const err = p2002WithoutAdapterMessage('OrgVolunteer');

		expect(isUniqueViolationOn(err, ROSTER)).toBe(true);
		expect(isUniqueViolationOn(err, APPLICATION)).toBe(false);
	});

	it('ignores non-P2002 Prisma errors', () => {
		const notFound = p2002Error(ROSTER);
		(notFound as { code: string }).code = 'P2025';

		expect(isUniqueViolationOn(notFound, ROSTER)).toBe(false);
	});

	it('ignores errors that are not Prisma errors at all', () => {
		expect(isUniqueViolationOn(new Error('boom'), ROSTER)).toBe(false);
		expect(isUniqueViolationOn(null, ROSTER)).toBe(false);
		expect(isUniqueViolationOn(undefined, ROSTER)).toBe(false);
		expect(isUniqueViolationOn({ code: 'P2002' }, ROSTER)).toBe(false);
	});
});
