import { describe, expect, it } from 'vitest';
import { checkrAdapter } from '../checkr';
import { getAdapter } from '../registry';
import { sterlingAdapter } from '../sterling';

describe('getAdapter', () => {
	it('returns checkrAdapter for CHECKR', () => {
		expect(getAdapter('CHECKR')).toBe(checkrAdapter);
	});

	it('returns sterlingAdapter for STERLING', () => {
		expect(getAdapter('STERLING')).toBe(sterlingAdapter);
	});

	it('returns null for unknown provider', () => {
		expect(getAdapter('UNKNOWN' as never)).toBeNull();
	});
});
