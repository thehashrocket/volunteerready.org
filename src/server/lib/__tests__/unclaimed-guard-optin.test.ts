import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The unclaimed guard is opt-in, which means the set of senders that opt in IS
 * the specification. A per-sender unit test cannot express "and nothing else
 * suppresses" — only a scan of the tree can, and that half is the half that
 * matters: the failure this guards against is someone adding
 * `suppressUnclaimed: true` to a transactional sender, at which point an
 * applicant stops hearing back about their own application and nobody notices.
 *
 * Mirrors the source-scan approach used by `volunteer-status-badge.test.tsx`
 * (asserting no hex literals) for the same reason — some invariants are about
 * the code, not a single call's behaviour.
 *
 * If you are here because this test failed after you added a sender: adding to
 * ALLOWED is a real decision. The bar is "does this push mail the recipient
 * never asked for?" — not "is this sent by a cron".
 */
const ALLOWED = new Set([
	'src/server/services/digest-service.ts',
	'src/server/services/reengagement-service.ts',
	'src/server/services/opportunityDigestService.ts',
	'src/server/services/shift-reminder-service.ts',
]);

/**
 * `sendEmail` itself defines the option, so it necessarily mentions it. Tests
 * are excluded wholesale below rather than listed here — a test is not a
 * sender, and enumerating them would mean this file needs editing every time
 * someone adds coverage.
 */
const INFRASTRUCTURE = new Set(['src/server/lib/email.ts']);

const isTestFile = (f: string) => /\.(test|spec)\.tsx?$/.test(f);

const SRC = path.resolve(__dirname, '../../..');

function walk(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'generated' || entry === 'node_modules') continue;
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, acc);
		else if (/\.tsx?$/.test(entry)) acc.push(full);
	}
	return acc;
}

function relative(file: string) {
	return path.relative(path.resolve(SRC, '..'), file);
}

describe('unclaimed guard opt-in surface', () => {
	const files = walk(SRC);

	// Match the PROPERTY NAME, not `: true`. Requiring the literal let two
	// things through, both proven by mutation: a non-literal value
	// (`{ suppressUnclaimed: BULK }`) in a transactional sender was invisible,
	// and commenting a live call out (`// TODO: re-enable — { suppressUnclaimed:
	// true }`) still satisfied the scan while the guard was actually off. Only
	// these four files should mention the option at all, so the ALLOWED
	// comparison below carries the value check on its own.
	const optedIn = files
		.filter((f) => /suppressUnclaimed\s*:/.test(readFileSync(f, 'utf8')))
		.map(relative)
		.filter((f) => !INFRASTRUCTURE.has(f) && !isTestFile(f))
		.sort();

	it('SECURITY: exactly the four bulk senders opt in, and nothing else', () => {
		expect(optedIn).toEqual([...ALLOWED].sort());
	});

	it('SECURITY: the magic-link sender never opts in', () => {
		// NextAuth throws when sendEmail returns false, so suppressing here would
		// turn "sign in" into a hard error for the exact users the roster creates
		// — and signing in is the ONLY way out of UNCLAIMED.
		const authEmail = readFileSync(path.join(SRC, 'server/auth.ts'), 'utf8');
		expect(authEmail).not.toMatch(/suppressUnclaimed\s*:/);
	});

	it('SECURITY: the roster-added notification never opts in', () => {
		// It tells someone an org just added them. Suppressing it would mean the
		// only person who does not learn about the roster row is its subject.
		const roster = readFileSync(
			path.join(SRC, 'server/repositories/sendRosterAddedEmail.ts'),
			'utf8',
		);
		// The option syntax, not the word: T12's doc comment names the option
		// explicitly to record that omitting it is deliberate, which is exactly
		// the behaviour being asserted here.
		expect(roster).not.toMatch(/suppressUnclaimed\s*:/);
	});
});
