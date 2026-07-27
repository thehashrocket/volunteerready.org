import { describe, expect, it, vi } from 'vitest';

// The module opens a Prisma client at import time; stub it so the pure
// tie-break logic can be tested without a database.
vi.mock('./prisma-client', () => ({ prisma: {} }));

import { pickSurvivor } from './check-email-collisions';

type Row = {
	id: string;
	email: string | null;
	name: string | null;
	emailVerified: Date | null;
	createdAt: Date;
};

function row(overrides: Partial<Row> & { id: string }): Row {
	return {
		email: 'bob@shelter.org',
		name: null,
		emailVerified: null,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		...overrides,
	};
}

describe('scripts/check-email-collisions pickSurvivor', () => {
	it('keeps the verified row over an older unverified one', () => {
		const older = row({
			id: 'a',
			createdAt: new Date('2025-01-01T00:00:00Z'),
			emailVerified: null,
		});
		const verified = row({
			id: 'b',
			createdAt: new Date('2026-06-01T00:00:00Z'),
			emailVerified: new Date('2026-06-02T00:00:00Z'),
		});

		// Verified wins even though it is the newer row — this is the whole
		// point of the rule, so pin it explicitly.
		expect(pickSurvivor([older, verified]).id).toBe('b');
		expect(pickSurvivor([verified, older]).id).toBe('b');
	});

	it('falls back to older createdAt when NEITHER is verified', () => {
		const older = row({ id: 'a', createdAt: new Date('2025-01-01T00:00:00Z') });
		const newer = row({ id: 'b', createdAt: new Date('2026-01-01T00:00:00Z') });
		expect(pickSurvivor([newer, older]).id).toBe('a');
	});

	it('falls back to older createdAt when BOTH are verified', () => {
		const older = row({
			id: 'a',
			createdAt: new Date('2025-01-01T00:00:00Z'),
			emailVerified: new Date('2025-01-02T00:00:00Z'),
		});
		const newer = row({
			id: 'b',
			createdAt: new Date('2026-01-01T00:00:00Z'),
			emailVerified: new Date('2026-01-02T00:00:00Z'),
		});
		expect(pickSurvivor([newer, older]).id).toBe('a');
	});

	it('breaks a createdAt tie deterministically on lower id', () => {
		const same = new Date('2026-01-01T00:00:00Z');
		const a = row({ id: 'aaa', createdAt: same });
		const b = row({ id: 'bbb', createdAt: same });
		expect(pickSurvivor([b, a]).id).toBe('aaa');
		expect(pickSurvivor([a, b]).id).toBe('aaa');
	});

	it('handles a 3-row group with exactly one verified', () => {
		const rows = [
			row({ id: 'a', createdAt: new Date('2024-01-01T00:00:00Z') }),
			row({
				id: 'b',
				createdAt: new Date('2026-01-01T00:00:00Z'),
				emailVerified: new Date('2026-01-02T00:00:00Z'),
			}),
			row({ id: 'c', createdAt: new Date('2025-01-01T00:00:00Z') }),
		];
		expect(pickSurvivor(rows).id).toBe('b');
	});

	it('is stable — does not mutate the input array order', () => {
		const rows = [
			row({ id: 'z', createdAt: new Date('2026-01-01T00:00:00Z') }),
			row({ id: 'a', createdAt: new Date('2025-01-01T00:00:00Z') }),
		];
		pickSurvivor(rows);
		expect(rows.map((r) => r.id)).toEqual(['z', 'a']);
	});
});
