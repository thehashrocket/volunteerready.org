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
