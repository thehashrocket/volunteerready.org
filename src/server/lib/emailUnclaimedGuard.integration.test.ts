/**
 * Integration tests for the T4 unclaimed email guard.
 *
 * Uses real Postgres. Run with: pnpm test:integration
 *
 * WHY INTEGRATION AND NOT UNIT
 * ----------------------------
 * `email.test.ts` covers the branching with a mocked Prisma, and a mock will
 * cheerfully return whatever the test tells it to. It therefore cannot catch
 * the failure this guard is most likely to have, which is the one the design's
 * own failure-mode table lists as "case-variant email misses the row, fails
 * open": the guard looks the recipient up by email, and `User.email` is stored
 * by a database trigger the ORM cannot see (T1, migration 20260726225900). If
 * `normalizeEmail()` in the app and `lower(btrim(...))` in the trigger ever
 * drift, the lookup silently misses and the guard mails the exact person it
 * exists to protect — with every unit test still green.
 *
 * Only Resend is mocked here. The database is real, the trigger is real, and
 * `SUPPRESSED_UNCLAIMED` is asserted as an actual row.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
vi.mock('@/server/lib/resend', () => ({
	getResend: () => ({ emails: { send: mockSend } }),
	getFromEmail: () => 'noreply@volunteerready.test',
}));

import { sendEmail } from '@/server/lib/email';
import { prisma } from '@/server/repositories/prisma';

const PREFIX = '__unclaimed_guard_integration__';

beforeEach(() => {
	mockSend.mockReset();
	mockSend.mockResolvedValue({ data: { id: 'msg-integration' } });
	delete process.env.UNCLAIMED_EMAIL_GUARD_ENABLED;
});

afterEach(async () => {
	// Delete only rows this file created. Stored addresses are lowercase by
	// definition (the T1 trigger), and PREFIX is lowercase, so this is exact.
	await prisma.emailEvent.deleteMany({ where: { to: { startsWith: PREFIX } } });
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

async function createUserWithState(
	rawEmail: string,
	accountState: 'ACTIVE' | 'UNCLAIMED',
) {
	return prisma.user.create({
		data: { email: rawEmail, accountState },
		select: { id: true },
	});
}

describe('unclaimed guard against a real database', () => {
	it('SECURITY: suppresses a real UNCLAIMED row and writes a real event', async () => {
		const email = `${PREFIX}shadow@example.com`;
		await createUserWithState(email, 'UNCLAIMED');

		const result = await sendEmail(
			email,
			'Your shift is tomorrow',
			'<p>x</p>',
			{
				suppressUnclaimed: true,
			},
		);

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();

		const events = await prisma.emailEvent.findMany({ where: { to: email } });
		expect(events).toHaveLength(1);
		expect(events[0].eventType).toBe('SUPPRESSED_UNCLAIMED');
		// Nothing was handed to Resend, so there is no message id to record.
		expect(events[0].resendId).toBeNull();
	});

	it('SECURITY: finds the row when the caller passes a case variant', async () => {
		// The trigger stored this lowercased. A sender that carries the address
		// through in its original case must still match.
		const stored = `${PREFIX}mixed@example.com`;
		await createUserWithState(`${PREFIX}Mixed@Example.COM`, 'UNCLAIMED');

		const result = await sendEmail(
			`${PREFIX}MIXED@EXAMPLE.COM`,
			'Digest',
			'<p>x</p>',
			{ suppressUnclaimed: true },
		);

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();
		const events = await prisma.emailEvent.findMany({ where: { to: stored } });
		expect(events).toHaveLength(1);
	});

	it('SECURITY: finds the row when the caller passes untrimmed whitespace', async () => {
		// This is the case a bare .toLowerCase() would miss. `lower(btrim(...))`
		// in the trigger and `normalizeEmail()` in the app must agree on BOTH
		// halves, not just the lowercasing.
		const stored = `${PREFIX}padded@example.com`;
		await createUserWithState(`${PREFIX}Padded@Example.com`, 'UNCLAIMED');

		const result = await sendEmail(`  ${stored}  `, 'Digest', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it('sends to a real ACTIVE row', async () => {
		const email = `${PREFIX}active@example.com`;
		await createUserWithState(email, 'ACTIVE');

		const result = await sendEmail(email, 'Digest', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();

		const suppressed = await prisma.emailEvent.findMany({
			where: { to: email, eventType: 'SUPPRESSED_UNCLAIMED' },
		});
		expect(suppressed).toHaveLength(0);
	});

	it('SECURITY: an UNCLAIMED row still receives mail from a sender that does not opt in', async () => {
		const email = `${PREFIX}transactional@example.com`;
		await createUserWithState(email, 'UNCLAIMED');

		const result = await sendEmail(email, 'You were added', '<p>x</p>');

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
	});

	it('the kill switch lets suppressed mail through again', async () => {
		process.env.UNCLAIMED_EMAIL_GUARD_ENABLED = 'false';
		const email = `${PREFIX}killswitch@example.com`;
		await createUserWithState(email, 'UNCLAIMED');

		const result = await sendEmail(email, 'Digest', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
	});

	it('the SUPPRESSED_UNCLAIMED enum value exists in the database', async () => {
		// Guards the hand-written migration: schema.prisma and the generated
		// client would both typecheck against a value Postgres does not have.
		const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
			SELECT e.enumlabel FROM pg_enum e
			JOIN pg_type t ON t.oid = e.enumtypid
			WHERE t.typname = 'EmailEventType'
		`;
		expect(rows.map((r) => r.enumlabel)).toContain('SUPPRESSED_UNCLAIMED');
	});
});
