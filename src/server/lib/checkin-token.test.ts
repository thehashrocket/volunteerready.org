import { afterEach, describe, expect, it } from 'vitest';
import {
	formatQrData,
	generateCheckinToken,
	parseQrData,
	validateCheckinToken,
} from './checkin-token';

const SECRET = 'test-secret-key-for-unit-tests';
const SHIFT_ID = 'clshift123abc';
const USER_ID = 'cluser456def';

describe('checkin-token', () => {
	describe('generateCheckinToken', () => {
		it('produces deterministic output for same inputs', () => {
			const now = new Date('2026-03-19T12:00:00Z');
			const t1 = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now);
			const t2 = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now);
			expect(t1).toBe(t2);
			expect(t1).toHaveLength(64); // SHA256 hex
		});

		it('produces different output for different time windows', () => {
			const now1 = new Date('2026-03-19T12:00:00Z');
			const now2 = new Date('2026-03-19T12:06:00Z'); // 6 min later = different window
			const t1 = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now1);
			const t2 = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now2);
			expect(t1).not.toBe(t2);
		});
	});

	describe('validateCheckinToken', () => {
		it('accepts current window token', () => {
			const now = new Date('2026-03-19T12:02:00Z');
			const token = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now);
			expect(validateCheckinToken(SECRET, SHIFT_ID, USER_ID, token, now)).toBe(
				true,
			);
		});

		it('accepts previous window token', () => {
			const generateTime = new Date('2026-03-19T12:04:00Z'); // window N
			const validateTime = new Date('2026-03-19T12:06:00Z'); // window N+1
			const token = generateCheckinToken(
				SECRET,
				SHIFT_ID,
				USER_ID,
				generateTime,
			);
			expect(
				validateCheckinToken(SECRET, SHIFT_ID, USER_ID, token, validateTime),
			).toBe(true);
		});

		it('rejects token from 2+ windows ago', () => {
			const generateTime = new Date('2026-03-19T12:00:00Z'); // window N
			const validateTime = new Date('2026-03-19T12:11:00Z'); // window N+2
			const token = generateCheckinToken(
				SECRET,
				SHIFT_ID,
				USER_ID,
				generateTime,
			);
			expect(
				validateCheckinToken(SECRET, SHIFT_ID, USER_ID, token, validateTime),
			).toBe(false);
		});

		it('rejects wrong shiftId', () => {
			const now = new Date('2026-03-19T12:00:00Z');
			const token = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now);
			expect(
				validateCheckinToken(SECRET, 'wrongshift', USER_ID, token, now),
			).toBe(false);
		});

		it('rejects wrong userId', () => {
			const now = new Date('2026-03-19T12:00:00Z');
			const token = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, now);
			expect(
				validateCheckinToken(SECRET, SHIFT_ID, 'wronguser', token, now),
			).toBe(false);
		});
	});

	describe('parseQrData', () => {
		it('parses valid format', () => {
			const token = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, new Date());
			const raw = `vr:1|${SHIFT_ID}|${USER_ID}|${token}`;
			const result = parseQrData(raw);
			expect(result).toEqual({
				version: 1,
				shiftId: SHIFT_ID,
				userId: USER_ID,
				token,
			});
		});

		it('returns null for malformed input', () => {
			expect(parseQrData('garbage')).toBeNull();
			expect(parseQrData('')).toBeNull();
			expect(parseQrData('vr:1|only|two')).toBeNull();
		});

		it('returns null for wrong version prefix', () => {
			const token = 'a'.repeat(64);
			expect(parseQrData(`vx:1|${SHIFT_ID}|${USER_ID}|${token}`)).toBeNull();
		});
	});

	describe('formatQrData', () => {
		it('round-trips with parseQrData', () => {
			const token = generateCheckinToken(SECRET, SHIFT_ID, USER_ID, new Date());
			const formatted = formatQrData(SHIFT_ID, USER_ID, token);
			const parsed = parseQrData(formatted);
			expect(parsed).toEqual({
				version: 1,
				shiftId: SHIFT_ID,
				userId: USER_ID,
				token,
			});
		});
	});

	describe('env secret validation', () => {
		const originalEnv = process.env.CHECKIN_HMAC_SECRET;

		afterEach(() => {
			if (originalEnv !== undefined) {
				process.env.CHECKIN_HMAC_SECRET = originalEnv;
			} else {
				delete process.env.CHECKIN_HMAC_SECRET;
			}
		});

		it('throws if CHECKIN_HMAC_SECRET is not set', async () => {
			delete process.env.CHECKIN_HMAC_SECRET;
			const { generateCheckinTokenFromEnv } = await import('./checkin-token');
			expect(() => generateCheckinTokenFromEnv(SHIFT_ID, USER_ID)).toThrow(
				'CHECKIN_HMAC_SECRET is not configured',
			);
		});
	});
});
