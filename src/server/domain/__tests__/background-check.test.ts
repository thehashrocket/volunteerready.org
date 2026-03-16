import { describe, expect, it } from 'vitest';
import {
	isTerminalStatus,
	mapCheckrResultToStatus,
	sanitizeCheckrPayload,
	shouldAutoIssueCredential,
} from '../background-check';

// ---------------------------------------------------------------------------
// mapCheckrResultToStatus
// ---------------------------------------------------------------------------

describe('mapCheckrResultToStatus', () => {
	it("maps 'clear' to COMPLETE", () => {
		expect(mapCheckrResultToStatus('clear')).toBe('COMPLETE');
	});

	it("maps 'consider' to CONSIDER", () => {
		expect(mapCheckrResultToStatus('consider')).toBe('CONSIDER');
	});

	it("maps 'adverse_action' to FAILED", () => {
		expect(mapCheckrResultToStatus('adverse_action')).toBe('FAILED');
	});

	it("maps 'suspended' to FAILED", () => {
		expect(mapCheckrResultToStatus('suspended')).toBe('FAILED');
	});

	it("maps 'dispute' to FAILED", () => {
		expect(mapCheckrResultToStatus('dispute')).toBe('FAILED');
	});

	it('maps unknown string to FAILED', () => {
		expect(mapCheckrResultToStatus('unknown_result')).toBe('FAILED');
	});

	it('maps empty string to FAILED', () => {
		expect(mapCheckrResultToStatus('')).toBe('FAILED');
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
// sanitizeCheckrPayload
// ---------------------------------------------------------------------------

describe('sanitizeCheckrPayload', () => {
	it('strips ssn from payload', () => {
		const result = sanitizeCheckrPayload({ id: 'rep_123', ssn: '123456789' });
		expect(result).not.toHaveProperty('ssn');
		expect(result.id).toBe('rep_123');
	});

	it('strips dob from payload', () => {
		const result = sanitizeCheckrPayload({ id: 'rep_123', dob: '1990-01-01' });
		expect(result).not.toHaveProperty('dob');
	});

	it('strips all known PII fields', () => {
		const result = sanitizeCheckrPayload({
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
		const result = sanitizeCheckrPayload({
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
		const result = sanitizeCheckrPayload({
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
		const result = sanitizeCheckrPayload({
			id: 'rep_123',
			records: [{ type: 'criminal', ssn: '123456789', case_number: 'CR-001' }],
		});
		const records = result.records as Array<Record<string, unknown>>;
		expect(records[0]).not.toHaveProperty('ssn');
		expect(records[0]?.case_number).toBe('CR-001');
	});

	it('returns empty object for null input', () => {
		expect(sanitizeCheckrPayload(null)).toEqual({});
	});

	it('returns empty object for non-object input', () => {
		expect(sanitizeCheckrPayload('string')).toEqual({});
		expect(sanitizeCheckrPayload(42)).toEqual({});
	});

	it('returns empty object for array input', () => {
		expect(sanitizeCheckrPayload([{ ssn: '123' }])).toEqual({});
	});
});
