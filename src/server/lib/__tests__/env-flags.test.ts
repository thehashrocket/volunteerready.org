import { afterEach, describe, expect, it } from 'vitest';
import { isEnabled } from '@/server/lib/env-flags';

// A REAL switch name, not a placeholder. `isEnabled` takes a `KillSwitch`
// union so a typo'd name cannot compile — but `tsconfig.json` excludes
// `**/*.test.ts`, so a test is the one place that protection does not apply.
// Using a real name keeps this honest about what it exercises.
const NAME = 'UNCLAIMED_EMAIL_GUARD_ENABLED';

describe('isEnabled', () => {
	afterEach(() => {
		delete process.env[NAME];
	});

	it('defaults to enabled when the variable is unset', () => {
		// The whole point: an unconfigured environment — local dev, CI, a preview
		// deploy, a Vercel project where nobody added the var — must behave like
		// production, or the guarded behaviour is only ever exercised in prod.
		delete process.env[NAME];
		expect(isEnabled(NAME)).toBe(true);
	});

	it('is disabled only by the exact string "false"', () => {
		process.env[NAME] = 'false';
		expect(isEnabled(NAME)).toBe(false);
	});

	it('SECURITY: a typo fails toward enabled, never toward disabled', () => {
		// These guard privacy controls. A value nobody anticipated must not
		// silently switch one off.
		for (const value of [
			'0',
			'no',
			'off',
			'False',
			'FALSE',
			'',
			' false',
			'true',
		]) {
			process.env[NAME] = value;
			expect(isEnabled(NAME), `value=${JSON.stringify(value)}`).toBe(true);
		}
	});

	it('reads at call time so a later change takes effect', () => {
		// A module-scope read would freeze whichever value was present at import,
		// which would make every test after the first one lie.
		delete process.env[NAME];
		expect(isEnabled(NAME)).toBe(true);
		process.env[NAME] = 'false';
		expect(isEnabled(NAME)).toBe(false);
		delete process.env[NAME];
		expect(isEnabled(NAME)).toBe(true);
	});
});
