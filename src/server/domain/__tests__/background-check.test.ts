import { describe, expect, it } from 'vitest';
import {
	canFinalizeAdverseAction,
	canResolveFcra,
	canSendPreAdverseNotice,
	FCRA_WAITING_PERIOD_DAYS,
	isTerminalStatus,
	isWaitingPeriodElapsed,
	mapResultToStatus,
	sanitizeWebhookPayload,
	shouldAutoIssueCredential,
	submittedNameMatchesAccount,
	waitingPeriodDaysRemaining,
} from '../background-check';

// ---------------------------------------------------------------------------
// mapResultToStatus
// ---------------------------------------------------------------------------

describe('mapResultToStatus', () => {
	it("maps 'clear' to COMPLETE", () => {
		expect(mapResultToStatus('clear')).toBe('COMPLETE');
	});

	it("maps 'consider' to CONSIDER", () => {
		expect(mapResultToStatus('consider')).toBe('CONSIDER');
	});

	it("maps 'adverse_action' to FAILED", () => {
		expect(mapResultToStatus('adverse_action')).toBe('FAILED');
	});

	it("maps 'suspended' to FAILED", () => {
		expect(mapResultToStatus('suspended')).toBe('FAILED');
	});

	it("maps 'dispute' to FAILED", () => {
		expect(mapResultToStatus('dispute')).toBe('FAILED');
	});

	it('maps unknown string to FAILED', () => {
		expect(mapResultToStatus('unknown_result')).toBe('FAILED');
	});

	it('maps empty string to FAILED', () => {
		expect(mapResultToStatus('')).toBe('FAILED');
	});
});

// ---------------------------------------------------------------------------
// isTerminalStatus
// ---------------------------------------------------------------------------

describe('isTerminalStatus', () => {
	it('returns true for COMPLETE', () => {
		expect(isTerminalStatus('COMPLETE')).toBe(true);
	});

	it('returns true for FAILED', () => {
		expect(isTerminalStatus('FAILED')).toBe(true);
	});

	it('returns true for CANCELLED', () => {
		expect(isTerminalStatus('CANCELLED')).toBe(true);
	});

	it('returns false for PENDING', () => {
		expect(isTerminalStatus('PENDING')).toBe(false);
	});

	it('returns false for CONSIDER', () => {
		expect(isTerminalStatus('CONSIDER')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// shouldAutoIssueCredential
// ---------------------------------------------------------------------------

describe('shouldAutoIssueCredential', () => {
	it('returns true for COMPLETE', () => {
		expect(shouldAutoIssueCredential('COMPLETE')).toBe(true);
	});

	it('returns false for CONSIDER', () => {
		expect(shouldAutoIssueCredential('CONSIDER')).toBe(false);
	});

	it('returns false for FAILED', () => {
		expect(shouldAutoIssueCredential('FAILED')).toBe(false);
	});

	it('returns false for CANCELLED', () => {
		expect(shouldAutoIssueCredential('CANCELLED')).toBe(false);
	});

	it('returns false for PENDING', () => {
		expect(shouldAutoIssueCredential('PENDING')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// FCRA state machine guards
// ---------------------------------------------------------------------------

describe('canSendPreAdverseNotice', () => {
	it('returns true for NONE', () => {
		expect(canSendPreAdverseNotice('NONE')).toBe(true);
	});

	it('returns false for PRE_ADVERSE_SENT', () => {
		expect(canSendPreAdverseNotice('PRE_ADVERSE_SENT')).toBe(false);
	});

	it('returns false for ADVERSE_ACTION_SENT', () => {
		expect(canSendPreAdverseNotice('ADVERSE_ACTION_SENT')).toBe(false);
	});

	it('returns false for RESOLVED', () => {
		expect(canSendPreAdverseNotice('RESOLVED')).toBe(false);
	});
});

describe('canFinalizeAdverseAction', () => {
	it('returns true for PRE_ADVERSE_SENT', () => {
		expect(canFinalizeAdverseAction('PRE_ADVERSE_SENT')).toBe(true);
	});

	it('returns false for NONE', () => {
		expect(canFinalizeAdverseAction('NONE')).toBe(false);
	});

	it('returns false for ADVERSE_ACTION_SENT', () => {
		expect(canFinalizeAdverseAction('ADVERSE_ACTION_SENT')).toBe(false);
	});

	it('returns false for RESOLVED', () => {
		expect(canFinalizeAdverseAction('RESOLVED')).toBe(false);
	});
});

describe('canResolveFcra', () => {
	it('returns true for NONE', () => {
		expect(canResolveFcra('NONE')).toBe(true);
	});

	it('returns true for PRE_ADVERSE_SENT', () => {
		expect(canResolveFcra('PRE_ADVERSE_SENT')).toBe(true);
	});

	it('returns false for ADVERSE_ACTION_SENT', () => {
		expect(canResolveFcra('ADVERSE_ACTION_SENT')).toBe(false);
	});

	it('returns false for RESOLVED', () => {
		expect(canResolveFcra('RESOLVED')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// FCRA waiting period
// ---------------------------------------------------------------------------

describe('isWaitingPeriodElapsed', () => {
	it('returns false before waiting period (4 days 23 hours)', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-15T11:00:00Z'); // 4d 23h
		expect(isWaitingPeriodElapsed(sentAt, now)).toBe(false);
	});

	it('returns true at exactly 5 days', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-15T12:00:00Z'); // exactly 5d
		expect(isWaitingPeriodElapsed(sentAt, now)).toBe(true);
	});

	it('returns true after 6 days', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-16T12:00:00Z'); // 6d
		expect(isWaitingPeriodElapsed(sentAt, now)).toBe(true);
	});

	it('returns false for same timestamp', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		expect(isWaitingPeriodElapsed(sentAt, sentAt)).toBe(false);
	});
});

describe('waitingPeriodDaysRemaining', () => {
	it('returns days remaining when period not elapsed', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-13T12:00:00Z'); // 3d elapsed
		expect(waitingPeriodDaysRemaining(sentAt, now)).toBe(2);
	});

	it('returns 0 when period has elapsed', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-16T12:00:00Z'); // 6d elapsed
		expect(waitingPeriodDaysRemaining(sentAt, now)).toBe(0);
	});

	it('returns 5 at the start', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		expect(waitingPeriodDaysRemaining(sentAt, sentAt)).toBe(
			FCRA_WAITING_PERIOD_DAYS,
		);
	});

	it('rounds up partial days', () => {
		const sentAt = new Date('2026-03-10T12:00:00Z');
		const now = new Date('2026-03-13T13:00:00Z'); // 3d 1h elapsed → 2 remaining (ceil)
		expect(waitingPeriodDaysRemaining(sentAt, now)).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// sanitizeWebhookPayload
// ---------------------------------------------------------------------------

describe('sanitizeWebhookPayload', () => {
	it('strips ssn from payload', () => {
		const result = sanitizeWebhookPayload({ id: 'rep_123', ssn: '123456789' });
		expect(result).not.toHaveProperty('ssn');
		expect(result.id).toBe('rep_123');
	});

	it('strips dob from payload', () => {
		const result = sanitizeWebhookPayload({ id: 'rep_123', dob: '1990-01-01' });
		expect(result).not.toHaveProperty('dob');
	});

	it('strips all known PII fields', () => {
		const result = sanitizeWebhookPayload({
			id: 'rep_123',
			ssn: '123456789',
			dob: '1990-01-01',
			mother_maiden_name: 'Smith',
			driver_license_number: 'D1234567',
			zipcode: '90210',
			phone: '5551234567',
		});
		expect(result).not.toHaveProperty('ssn');
		expect(result).not.toHaveProperty('dob');
		expect(result).not.toHaveProperty('mother_maiden_name');
		expect(result).not.toHaveProperty('driver_license_number');
		expect(result).not.toHaveProperty('zipcode');
		expect(result).not.toHaveProperty('phone');
	});

	it('preserves non-PII fields', () => {
		const result = sanitizeWebhookPayload({
			id: 'rep_123',
			status: 'complete',
			result: 'clear',
			package: 'tasker_standard',
		});
		expect(result.id).toBe('rep_123');
		expect(result.status).toBe('complete');
		expect(result.result).toBe('clear');
		expect(result.package).toBe('tasker_standard');
	});

	it('strips PII from nested objects', () => {
		const result = sanitizeWebhookPayload({
			id: 'rep_123',
			candidate: {
				id: 'cand_abc',
				ssn: '123456789',
				dob: '1990-01-01',
				name: 'John Doe',
			},
		});
		const candidate = result.candidate as Record<string, unknown>;
		expect(candidate).not.toHaveProperty('ssn');
		expect(candidate).not.toHaveProperty('dob');
		expect(candidate.id).toBe('cand_abc');
		expect(candidate.name).toBe('John Doe');
	});

	it('strips PII from objects within arrays', () => {
		const result = sanitizeWebhookPayload({
			id: 'rep_123',
			records: [{ type: 'criminal', ssn: '123456789', case_number: 'CR-001' }],
		});
		const records = result.records as Array<Record<string, unknown>>;
		expect(records[0]).not.toHaveProperty('ssn');
		expect(records[0]?.case_number).toBe('CR-001');
	});

	it('returns empty object for null input', () => {
		expect(sanitizeWebhookPayload(null)).toEqual({});
	});

	it('returns empty object for non-object input', () => {
		expect(sanitizeWebhookPayload('string')).toEqual({});
		expect(sanitizeWebhookPayload(42)).toEqual({});
	});

	it('returns empty object for array input', () => {
		expect(sanitizeWebhookPayload([{ ssn: '123' }])).toEqual({});
	});
});

describe('submittedNameMatchesAccount', () => {
	it('accepts an exact match', () => {
		expect(submittedNameMatchesAccount('Jane Doe', 'Jane', 'Doe')).toBe(true);
	});

	it('accepts a longer legal name over a shorter account name', () => {
		// The realistic shape: the account says "Jane Smith", the FCRA form wants
		// the full legal name. Equality would flag every one of these.
		expect(
			submittedNameMatchesAccount('Jane Smith', 'Jane Q.', 'Smith-Jones'),
		).toBe(true);
	});

	it('accepts a match that differs only by diacritics or case', () => {
		expect(submittedNameMatchesAccount('josé garcía', 'Jose', 'Garcia')).toBe(
			true,
		);
	});

	it('flags two different people who share one name', () => {
		// The likeliest wrong-row case in a real spreadsheet: same surname,
		// different human. A one-token rule cleared both of these, which made the
		// signal blind to the exact mistake it exists to record. Found by the
		// Codex adversarial pass.
		expect(submittedNameMatchesAccount('John Smith', 'Robert', 'Smith')).toBe(
			false,
		);
		expect(submittedNameMatchesAccount('Maria Garcia', 'Maria', 'Lopez')).toBe(
			false,
		);
	});

	it('does not flag a non-Latin name against itself', () => {
		// The ASCII-only separator class deleted every character of these names,
		// leaving an empty token set that read as "nothing to compare" — so the
		// signal was silently dead for every volunteer whose name is not written
		// in the Latin alphabet. Both directions are asserted: the same person
		// must not flag, and a different person must.
		expect(submittedNameMatchesAccount('山田太郎', '太郎', '山田')).toBe(true);
		expect(
			submittedNameMatchesAccount('Ольга Иванова', 'Ольга', 'Иванова'),
		).toBe(true);
	});

	it('flags a different non-Latin name', () => {
		expect(submittedNameMatchesAccount('山田太郎', '花子', '鈴木')).toBe(false);
		expect(
			submittedNameMatchesAccount('Ольга Иванова', 'Пётр', 'Сидоров'),
		).toBe(false);
	});

	it('does not shatter names written with combining marks', () => {
		// Devanagari and Thai write vowels as \p{M}. A \p{L}\p{N}-only class
		// treated those marks as separators, so शर्मा broke into one-letter
		// fragments that corroborate almost anything — the second name-matching
		// bug, found by the Codex structured review after the first was fixed.
		expect(submittedNameMatchesAccount('राहुल शर्मा', 'राहुल', 'शर्मा')).toBe(true);
		expect(submittedNameMatchesAccount('राहुल शर्मा', 'अमित', 'शर्मा')).toBe(
			false,
		);
	});

	it('flags a wrong person against a separator-less account name', () => {
		// A one-token account is ambiguous: a mononym can only ever corroborate
		// once, but a separator-less FULL name contains both submitted tokens and
		// so must corroborate twice. Reading it as the former let 山田太郎 accept
		// 花子 山田 — shared family name, different person.
		expect(submittedNameMatchesAccount('山田太郎', '花子', '山田')).toBe(false);
		expect(submittedNameMatchesAccount('김민수', '민수', '이')).toBe(false);
	});

	it('does not let a bare Latin initial corroborate by containment', () => {
		// 'a' is inside 'jane', so blanket containment for one-character tokens
		// cleared a different person who shared only a surname. A letter of a
		// CASED script is a word fragment; an ideograph is a whole morpheme —
		// which is why the rule below keys on casedness rather than length.
		expect(submittedNameMatchesAccount('Jane Doe', 'A', 'Doe')).toBe(false);
		// The same initial still corroborates when it genuinely matches.
		expect(submittedNameMatchesAccount('J Doe', 'J', 'Doe')).toBe(true);
	});

	it('accepts a single-character surname inside a separator-less name', () => {
		// Chinese surnames are ONE character, so a 2-char floor on the submitted
		// token flagged the majority of Chinese names as mismatches — a false
		// positive on legitimate checks, which dilutes the signal precisely where
		// it is hardest to audit. Latin initials fail the same way.
		expect(submittedNameMatchesAccount('王小明', '小明', '王')).toBe(true);
		expect(submittedNameMatchesAccount('J Doe', 'J', 'Doe')).toBe(true);
	});

	it('accepts a single-token account name that corresponds', () => {
		// Only one side offers a second token, so one correspondence is all that
		// can be required — otherwise every mononym account flags forever.
		expect(submittedNameMatchesAccount('Smith', 'Robert', 'Smith')).toBe(true);
	});

	it('flags a wholly different person', () => {
		// The failure this exists to record: the coordinator names one volunteer
		// and types another row's identity underneath.
		expect(submittedNameMatchesAccount('Jane Doe', 'Robert', 'Jones')).toBe(
			false,
		);
	});

	it('flags a different person who shares only a suffix', () => {
		// Without NON_IDENTIFYING_NAME_TOKENS the shared "Jr" satisfies the
		// overlap test and this returns true — a miss in the only direction that
		// matters, since the whole function is a mismatch detector.
		expect(
			submittedNameMatchesAccount('John Smith Jr', 'Robert', 'Jones Jr'),
		).toBe(false);
	});

	it('does not flag an account with no name', () => {
		// Shadow users created from an email address alone have none, and that is
		// an absence of evidence, not a discrepancy.
		expect(submittedNameMatchesAccount(null, 'Jane', 'Doe')).toBe(true);
		expect(submittedNameMatchesAccount('   ', 'Jane', 'Doe')).toBe(true);
	});

	it('does not flag when a name carries no comparable tokens', () => {
		// Both sides of the guard, because they are separate branches: an account
		// name that is punctuation only, and a submitted name that is nothing but
		// a suffix. Neither states anything to disagree with.
		expect(submittedNameMatchesAccount('—', 'Jane', 'Doe')).toBe(true);
		expect(submittedNameMatchesAccount('Jane Doe', 'Jr', '.')).toBe(true);
	});
});
