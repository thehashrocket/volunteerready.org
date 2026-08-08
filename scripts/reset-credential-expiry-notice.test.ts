/**
 * Unit tests for the credential-expiry notice reset script.
 *
 * This is a DESTRUCTIVE maintenance script: it clears `notifiedAt`, which is
 * the notifier's entire idempotency record, so every credential it touches is
 * warned about again on the next nightly run. Pointed at the wrong org, or run
 * without the operator meaning to write, it re-emails a stranger's staff about
 * their volunteers. The safety rails are therefore the thing under test —
 * flag parsing that fails CLOSED, the id-before-slug resolution order, the
 * dry-run default, and the remote-database confirmation.
 *
 * The script has no exported surface (`main()` runs on import), so each case
 * re-imports the module with `process.argv` set, exactly as the shell invokes
 * it. `prisma.$disconnect()` runs in `main()`'s `.finally`, which makes it the
 * settle signal for every path.
 *
 *   pnpm test:scripts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
	const prisma = {
		auditLog: { findUnique: vi.fn(async () => null as unknown) },
		organization: { findUnique: vi.fn(async () => null as unknown) },
		volunteerCredential: {
			findMany: vi.fn(async () => [] as unknown[]),
			updateMany: vi.fn(async () => ({ count: 0 })),
		},
		$disconnect: vi.fn(async () => {}),
	};
	const question = vi.fn(async (_prompt: string) => '');
	const close = vi.fn();
	return { prisma, question, close };
});

vi.mock('./prisma-client', () => ({ prisma: h.prisma }));
vi.mock('node:readline/promises', () => ({
	createInterface: vi.fn(() => ({ question: h.question, close: h.close })),
}));

const { prisma, question } = h;

const LOCAL_DB = 'postgresql://u:p@localhost:5432/app';
const REMOTE_DB = 'postgresql://u:p@db.neon.tech:5432/app';

let exitCodes: number[] = [];
let exitSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
const realIsTTY = process.stdin.isTTY;
const realArgv = process.argv;

function setTTY(value: boolean) {
	Object.defineProperty(process.stdin, 'isTTY', {
		value,
		configurable: true,
	});
}

/** Everything printed to stdout and stderr, joined, for substring assertions. */
function output(): string {
	const calls = [...errorSpy.mock.calls, ...logSpy.mock.calls];
	return calls.map((c) => c.map(String).join(' ')).join('\n');
}

/**
 * Run the script as the shell would.
 *
 * `stopOnExit` makes the first `process.exit` throw, so execution actually
 * stops the way it does in production. It is opt-in because the script's own
 * `.catch` calls `process.exit` a second time, and a mock that always throws
 * would reject there instead. Use it wherever continuing past a refusal would
 * reach a write and make the assertion vacuous.
 */
async function runScript(
	argv: string[],
	opts: { stopOnExit?: boolean } = {},
): Promise<void> {
	exitCodes = [];
	let thrown = false;
	exitSpy.mockImplementation(((code?: number) => {
		exitCodes.push(code ?? 0);
		if (opts.stopOnExit && !thrown) {
			thrown = true;
			throw new Error('__process_exit__');
		}
		return undefined as never;
	}) as never);

	process.argv = ['node', 'scripts/reset-credential-expiry-notice.ts', ...argv];
	vi.resetModules();
	await import('./reset-credential-expiry-notice');
	await vi.waitFor(() => {
		expect(prisma.$disconnect).toHaveBeenCalled();
	});
}

/** A credential row as the `affected` projection returns it. */
function stamped(id: string, over: Record<string, unknown> = {}) {
	return {
		id,
		type: 'BACKGROUND_CHECK',
		expiresAt: new Date('2026-09-01T00:00:00.000Z'),
		notifiedAt: new Date('2026-08-01T00:00:00.000Z'),
		user: { name: 'Jane Doe', email: 'jane@example.com' },
		...over,
	};
}

const ORG = { id: 'org_cuid_1', slug: 'helping-hands' };

/** Arrange the org branch: org lookup, candidate ids, then the detail rows. */
function arrangeOrgRun(rows: ReturnType<typeof stamped>[]) {
	prisma.organization.findUnique.mockResolvedValueOnce(ORG as never);
	prisma.volunteerCredential.findMany
		.mockResolvedValueOnce(rows.map((r) => ({ id: r.id })) as never)
		.mockResolvedValueOnce(rows as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	// mockReset, not just clear: `clearAllMocks` leaves the `...Once` queue in
	// place, so an unconsumed row from one case silently answers the next one's
	// first query — which is how a "no such org" case got handed a live org.
	prisma.organization.findUnique.mockReset().mockResolvedValue(null as never);
	prisma.auditLog.findUnique.mockReset().mockResolvedValue(null as never);
	prisma.volunteerCredential.findMany
		.mockReset()
		.mockResolvedValue([] as never);
	prisma.volunteerCredential.updateMany
		.mockReset()
		.mockResolvedValue({ count: 0 } as never);
	prisma.$disconnect.mockReset().mockResolvedValue(undefined as never);
	question.mockReset().mockResolvedValue('');
	exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	process.env.DATABASE_URL = LOCAL_DB;
	setTTY(true);
});

afterEach(() => {
	vi.restoreAllMocks();
	process.argv = realArgv;
	Object.defineProperty(process.stdin, 'isTTY', {
		value: realIsTTY,
		configurable: true,
	});
});

// ---------------------------------------------------------------------------
// Flag parsing — the layer where a typo becomes a production write
// ---------------------------------------------------------------------------

describe('flag parsing', () => {
	it('accepts the SPACE-separated form its own usage text prints', async () => {
		// REGRESSION. The parser originally split only on `=`, so the exact
		// command in this script's usage output, its header docstring and
		// package.json — `--org helping-hands` — died with "Unexpected positional
		// argument" and exit 1. Every invocation copied from the help was broken.
		// Invisible because the script had no tests, and invisible to the tests
		// that arrived first because they all used `--org=`.
		arrangeOrgRun([stamped('cred_1')]);

		await runScript(['--org', 'helping-hands']);

		expect(output()).not.toContain('Unexpected positional argument');
		expect(output()).toContain('Org: helping-hands');
		expect(exitCodes).not.toContain(1);
	});

	it('accepts a switch before a valued flag in the space form', async () => {
		// `--yes` must not swallow `--org` as its value, which a naive
		// "next token is the value" parser would do.
		arrangeOrgRun([stamped('cred_1')]);

		await runScript(['--yes', '--org', 'helping-hands']);

		expect(output()).toContain('Org: helping-hands');
		expect(prisma.volunteerCredential.updateMany).toHaveBeenCalled();
	});

	it('SAFETY: refuses --dry-run together with --yes', async () => {
		// THE one that got through. `--dry-run` was parsed and then DISCARDED, so
		// this exact command line cleared notifiedAt — a live write causing real
		// re-sends to real staff, from an invocation that visibly reads
		// --dry-run. Reproduced by execution in review. Same defect CLAUDE.md
		// records against the roster importer, which refuses the combination.
		arrangeOrgRun([stamped('cred_1')]);

		await runScript(['--org', 'helping-hands', '--dry-run', '--yes']);

		expect(output()).toContain('mutually exclusive');
		expect(exitCodes).toContain(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('SAFETY: refuses the combination in either order or spelling', async () => {
		for (const argv of [
			['--yes', '--dry-run', '--org', 'helping-hands'],
			['--org=helping-hands', '--dry-run', '--yes'],
		]) {
			vi.clearAllMocks();
			arrangeOrgRun([stamped('cred_1')]);

			await runScript(argv);

			expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
		}
	});

	it('SAFETY: rejects an empty value rather than reading it as absent', async () => {
		// `--org=` parsed to '' and then read as "not supplied", so
		// `--org= --audit-run x` slipped past the mutual-exclusion check.
		await runScript(['--org=', '--audit-run=aud_1']);

		expect(output()).toContain('--org requires a value');
		expect(exitCodes).toContain(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('SAFETY: rejects an unknown flag rather than ignoring it', async () => {
		await runScript(['--org=helping-hands', '--dryrun']);

		expect(output()).toContain('Unknown flag: --dryrun');
		expect(exitCodes).toContain(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('SAFETY: rejects a repeated flag rather than taking the last one', async () => {
		await runScript(['--org=helping-hands', '--org=other-org', '--yes']);

		expect(output()).toContain('Flag --org given more than once');
		expect(exitCodes).toContain(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('rejects a bare positional argument, and a flag with no value', async () => {
		await runScript(['helping-hands']);
		expect(output()).toContain('Unexpected positional argument: helping-hands');

		errorSpy.mockClear();
		await runScript(['--org']);
		expect(output()).toContain('--org requires a value');

		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('SAFETY: refuses --yes=false rather than reading it as consent', async () => {
		arrangeOrgRun([stamped('c1')]);

		await runScript(['--org=helping-hands', '--yes=false']);

		expect(output()).toContain('--yes is a switch and takes no value');
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('requires one of --org or --audit-run', async () => {
		await runScript([], { stopOnExit: true });

		expect(output()).toContain('Usage: pnpm credentials:reset-notice');
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('refuses --org and --audit-run together rather than guessing', async () => {
		await runScript(['--org=helping-hands', '--audit-run=aud_1'], {
			stopOnExit: true,
		});

		expect(output()).toContain('--org and --audit-run are alternatives');
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Org resolution
// ---------------------------------------------------------------------------

describe('org resolution', () => {
	it('SAFETY: resolves an id BEFORE a slug, so a squatter cannot win', async () => {
		// An org may register another org's cuid as its slug. The id lookup must
		// come first and, when it hits, the slug lookup must not run at all.
		prisma.organization.findUnique.mockResolvedValueOnce(ORG as never);
		prisma.volunteerCredential.findMany
			.mockResolvedValueOnce([{ id: 'c1' }] as never)
			.mockResolvedValueOnce([stamped('c1')] as never);

		await runScript(['--org=org_cuid_1']);

		expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
		expect(prisma.organization.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'org_cuid_1' } }),
		);
	});

	it('falls back to the slug lookup when nothing matches the id', async () => {
		prisma.organization.findUnique
			.mockResolvedValueOnce(null as never)
			.mockResolvedValueOnce(ORG as never);
		prisma.volunteerCredential.findMany
			.mockResolvedValueOnce([{ id: 'c1' }] as never)
			.mockResolvedValueOnce([stamped('c1')] as never);

		await runScript(['--org=helping-hands']);

		expect(prisma.organization.findUnique).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ where: { slug: 'helping-hands' } }),
		);
		expect(output()).toContain('helping-hands');
	});

	it('exits when no organization matches the reference', async () => {
		await runScript(['--org=nope'], { stopOnExit: true });

		expect(output()).toContain('No organization matching "nope"');
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('selection', () => {
	it('selects every stamped credential in the org by default', async () => {
		arrangeOrgRun([stamped('c1'), stamped('c2')]);

		await runScript(['--org=helping-hands']);

		expect(prisma.volunteerCredential.findMany).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				where: { orgId: ORG.id, notifiedAt: { not: null } },
			}),
		);
	});

	it('narrows to stamps at or after --since', async () => {
		arrangeOrgRun([stamped('c1')]);

		await runScript(['--org=helping-hands', '--since=2026-08-05']);

		expect(prisma.volunteerCredential.findMany).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				where: {
					orgId: ORG.id,
					notifiedAt: { gte: new Date('2026-08-05') },
				},
			}),
		);
	});

	it('writes nothing when there is nothing stamped to un-stamp', async () => {
		// Two distinct branches, both of which must stop short of the write even
		// with --yes: no candidate at all, and candidates a concurrent reset
		// already cleared between the two reads.
		prisma.organization.findUnique.mockResolvedValueOnce(ORG as never);
		prisma.volunteerCredential.findMany.mockResolvedValueOnce([] as never);
		await runScript(['--org=helping-hands', '--yes']);
		expect(output()).toContain('Nothing to reset');

		logSpy.mockClear();
		prisma.organization.findUnique.mockResolvedValueOnce(ORG as never);
		prisma.volunteerCredential.findMany
			.mockResolvedValueOnce([{ id: 'c1' }] as never)
			.mockResolvedValueOnce([] as never);
		await runScript(['--org=helping-hands', '--yes']);
		expect(output()).toContain('All already un-stamped');

		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// --audit-run: the blast radius of one org's pass in one run
// ---------------------------------------------------------------------------

describe('--audit-run', () => {
	it('SAFETY: refuses an audit row with no orgId', async () => {
		// `AuditLog.orgId` is nullable. It used to coerce to '', which made the
		// remote slug confirmation compare against an empty string — so pressing
		// Enter satisfied the one rail --yes cannot substitute for.
		prisma.auditLog.findUnique.mockResolvedValueOnce({
			action: 'CREDENTIAL_EXPIRY_NOTICE_SENT',
			orgId: null,
			metadata: { credentialIds: ['c1'] },
		} as never);

		await runScript(['--audit-run', 'aud_1', '--yes']);

		expect(output()).toContain('has no orgId');
		expect(exitCodes).toContain(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('takes the credential ids from the audit row the notifier wrote', async () => {
		prisma.auditLog.findUnique.mockResolvedValueOnce({
			action: 'CREDENTIAL_EXPIRY_NOTICE_SENT',
			orgId: ORG.id,
			metadata: { credentialIds: ['c1', 'c2'] },
		} as never);
		prisma.organization.findUnique.mockResolvedValueOnce({
			slug: ORG.slug,
		} as never);
		prisma.volunteerCredential.findMany.mockResolvedValueOnce([
			stamped('c1'),
			stamped('c2'),
		] as never);

		await runScript(['--audit-run=aud_1', '--yes']);

		expect(prisma.volunteerCredential.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: ['c1', 'c2'] }, notifiedAt: { not: null } },
			}),
		);
		expect(prisma.volunteerCredential.updateMany).toHaveBeenCalledWith({
			where: { id: { in: ['c1', 'c2'] } },
			data: { notifiedAt: null },
		});
	});

	it('SAFETY: refuses an audit id that is not a notice row', async () => {
		prisma.auditLog.findUnique.mockResolvedValueOnce({
			action: 'CREDENTIAL_ISSUED',
			orgId: ORG.id,
			metadata: { credentialIds: ['c1'] },
		} as never);

		await runScript(['--audit-run=aud_1', '--yes'], { stopOnExit: true });

		expect(output()).toContain('No CREDENTIAL_EXPIRY_NOTICE_SENT audit row');
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// The write, and what stands in front of it
// ---------------------------------------------------------------------------

describe('the write', () => {
	it('SAFETY: a run without --yes is a dry run and writes nothing', async () => {
		arrangeOrgRun([stamped('c1'), stamped('c2')]);

		await runScript(['--org=helping-hands']);

		expect(output()).toContain('Dry run. Re-run with --yes to apply.');
		expect(output()).toContain('Credentials to un-stamp: 2');
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('clears notifiedAt on --yes against a local database, with no prompt', async () => {
		arrangeOrgRun([stamped('c1'), stamped('c2')]);
		prisma.volunteerCredential.updateMany.mockResolvedValueOnce({
			count: 2,
		} as never);

		await runScript(['--org=helping-hands', '--yes']);

		expect(question).not.toHaveBeenCalled();
		expect(prisma.volunteerCredential.updateMany).toHaveBeenCalledWith({
			where: { id: { in: ['c1', 'c2'] } },
			data: { notifiedAt: null },
		});
		expect(output()).toContain('Un-stamped 2 credential(s)');
	});

	it('SAFETY: refuses a remote write with no TTY, and never reads an answer', async () => {
		process.env.DATABASE_URL = REMOTE_DB;
		setTTY(false);
		arrangeOrgRun([stamped('c1')]);

		await runScript(['--org=helping-hands', '--yes'], { stopOnExit: true });

		expect(question).not.toHaveBeenCalled();
		expect(output()).toContain(
			'Refusing a non-dry-run against a remote database',
		);
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('SAFETY: refuses a remote write when the typed slug is a near-miss', async () => {
		process.env.DATABASE_URL = REMOTE_DB;
		arrangeOrgRun([stamped('c1')]);
		question.mockResolvedValueOnce('helping-hand');

		await runScript(['--org=helping-hands', '--yes'], { stopOnExit: true });

		expect(output()).toContain('Confirmation did not match');
		expect(exitCodes[0]).toBe(1);
		expect(prisma.volunteerCredential.updateMany).not.toHaveBeenCalled();
	});

	it('proceeds against a remote database once the resolved slug is typed back', async () => {
		process.env.DATABASE_URL = REMOTE_DB;
		arrangeOrgRun([stamped('c1')]);
		question.mockResolvedValueOnce('  helping-hands  ');
		prisma.volunteerCredential.updateMany.mockResolvedValueOnce({
			count: 1,
		} as never);

		await runScript(['--org=helping-hands', '--yes']);

		expect(question).toHaveBeenCalledTimes(1);
		expect(prisma.volunteerCredential.updateMany).toHaveBeenCalledWith({
			where: { id: { in: ['c1'] } },
			data: { notifiedAt: null },
		});
	});
});
