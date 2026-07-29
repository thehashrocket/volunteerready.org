import { describe, expect, it } from 'vitest';
import { BackgroundCheckProvider } from '@/prisma/generated/client';
import { thirdPartyServices, versionHistory } from './page';

/**
 * The privacy policy is the one page where being out of date is a compliance
 * problem rather than a marketing one, and it has already drifted twice:
 *
 * 1. It described data reaching an organisation only "when you apply", months
 *    after staff gained the ability to add volunteers from an email address.
 * 2. It named Checkr as the sole background-check provider while Sterling was
 *    live, connected per-org from `/app/settings/background-checks`, and
 *    receiving `ssn` and `dateOfBirth` (`adapters/background-check/sterling.ts`).
 *
 * Both were caught by a human reading the page against the code. These tests
 * make the second class mechanical: adding a provider to the Prisma enum
 * without disclosing it goes red.
 */
describe('privacy policy — third-party disclosure', () => {
	// The enum is the registry `getAdapter()` switches on, so every member is a
	// provider the platform can actually route a check to. Deriving the
	// expectation from the enum rather than a hardcoded list is the whole point:
	// a future `STERLING`-shaped addition cannot pass by being forgotten here.
	it('discloses every background check provider the platform can route to', () => {
		const disclosed = thirdPartyServices
			.filter((s) => s.purpose === 'Background checks')
			.map((s) => s.service.toLowerCase());

		for (const provider of Object.values(BackgroundCheckProvider)) {
			expect(
				disclosed.some((name) => name === provider.toLowerCase()),
				`BackgroundCheckProvider.${provider} can receive SSN and date of birth, but the privacy policy's third-party table does not disclose it. Add a row to thirdPartyServices in privacy/page.tsx (and check the prose in sections 1, 4 and 5, which name providers too).`,
			).toBe(true);
		}
	});

	// Every provider row must state the PII, not just the vendor name — the
	// disclosure that matters is *what they receive*, and both adapters post
	// `ssn` and `dateOfBirth`.
	it('states that background check providers receive SSN and DOB', () => {
		const rows = thirdPartyServices.filter(
			(s) => s.purpose === 'Background checks',
		);
		expect(rows.length).toBeGreaterThan(0);

		for (const row of rows) {
			expect(row.data).toContain('SSN');
			expect(row.data).toContain('DOB');
		}
	});
});

describe('privacy policy — version history', () => {
	// The footer ("effective as of <date> (Version <n>)") and versionHistory[0]
	// are two hand-edited strings that must agree, and a bump touching only one
	// publishes a legal document contradicting its own changelog. Asserting the
	// shape here is the cheap half; the footer itself is prose inside the
	// component, so this pins the source of truth the footer must be copied from.
	it('keeps the newest entry first, with a version and a date', () => {
		expect(versionHistory.length).toBeGreaterThan(0);

		const [newest] = versionHistory;
		expect(newest.version).toMatch(/^\d+\.\d+$/);
		expect(newest.date).toBeTruthy();
		expect(newest.changes).toBeTruthy();
	});

	it('has no duplicate version numbers', () => {
		const versions = versionHistory.map((v) => v.version);
		expect(new Set(versions).size).toBe(versions.length);
	});

	it('orders entries newest-first by date', () => {
		const times = versionHistory.map((v) => new Date(v.date).getTime());
		for (const t of times) expect(Number.isNaN(t)).toBe(false);

		const sorted = [...times].sort((a, b) => b - a);
		expect(times).toEqual(sorted);
	});
});
