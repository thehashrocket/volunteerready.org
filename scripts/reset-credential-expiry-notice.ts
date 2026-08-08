/**
 * Undo credential-expiry notice stamps so a batch can be warned about again.
 *
 * WHY THIS EXISTS. `VolunteerCredential.notifiedAt` is the only record that a
 * warning was issued, and the notifier's whole idempotency rests on it. A run
 * that stamped a batch and then failed to deliver — a Resend outage, a bad
 * template, an org emailed while it should have been suspended — leaves those
 * credentials permanently silent for the rest of their cycle, with no admin
 * surface and no way back short of hand-written production SQL. This is that
 * way back.
 *
 * Usage:
 *   pnpm credentials:reset-notice --org <slug-or-id> [--since <ISO>] [--yes]
 *   pnpm credentials:reset-notice --audit-run <auditLogId> [--yes]
 *
 * A dry run needs nothing and is the intended first step every time. It prints
 * exactly which credentials would be un-stamped and stops.
 *
 * Safety rails, matching `import-roster`:
 *   - a write run requires `--yes`
 *   - unknown flags are rejected rather than ignored, so a typo'd `--dryrun`
 *     cannot silently become a live write
 *   - no flag may be given twice — `--org a --org b` last-winning silently is
 *     how one duplicated slug ends up touching a stranger's tenant
 *   - against a non-local DATABASE_URL a write also requires the org's RESOLVED
 *     slug typed back at an interactive prompt, because a command aimed at the
 *     wrong org looks exactly as intended on the command line
 */
import { createInterface } from 'node:readline/promises';
import { prisma } from './prisma-client';

const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1'];

function isLocalDatabaseUrl(url: string): boolean {
	try {
		return LOCAL_DB_HOSTS.includes(new URL(url).hostname);
	} catch {
		return false;
	}
}

type Flags = Map<string, string | true>;

const KNOWN_FLAGS = new Set(['org', 'since', 'audit-run', 'yes', 'dry-run']);

function parseFlags(argv: readonly string[]): Flags {
	const flags: Flags = new Map();

	const set = (name: string, value: string | true) => {
		if (!KNOWN_FLAGS.has(name)) {
			throw new Error(`Unknown flag: --${name}`);
		}
		if (flags.has(name)) {
			throw new Error(`Flag --${name} given more than once`);
		}
		flags.set(name, value);
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (!arg.startsWith('--')) {
			throw new Error(`Unexpected positional argument: ${arg}`);
		}

		// BOTH `--key=value` and `--key value`, because both get typed — and
		// because this script's own usage text prints the space form. It
		// accepted only `--key=value` at first, so every invocation copied from
		// the help output died with "Unexpected positional argument". Nothing
		// caught it because the script had no tests; the coverage audit found it
		// on the first run. `import-roster.ts` had already learned this.
		const eq = arg.indexOf('=');
		if (eq !== -1) {
			set(arg.slice(2, eq), arg.slice(eq + 1));
			continue;
		}

		const name = arg.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith('--')) {
			set(name, next);
			i++;
		} else {
			set(name, true);
		}
	}
	return flags;
}

/** A switch must not carry a value: `--yes=false` reads as consent otherwise. */
function readSwitch(flags: Flags, name: string): boolean {
	const value = flags.get(name);
	if (value === undefined) return false;
	if (value !== true) {
		throw new Error(
			`--${name} is a switch and takes no value (got "${value}")`,
		);
	}
	return true;
}

function readValue(flags: Flags, name: string): string | null {
	const value = flags.get(name);
	if (value === undefined) return null;
	if (value === true) throw new Error(`--${name} requires a value`);
	// `--org=` parses to '' and would then read as "not supplied", which slips
	// past the --org/--audit-run mutual-exclusion check below.
	if (value === '') throw new Error(`--${name} requires a value`);
	return value;
}

async function confirmSlug(expected: string): Promise<boolean> {
	// An empty expectation would be satisfied by pressing Enter, which turns the
	// one rail `--yes` cannot substitute for into no rail at all.
	//
	// UNREACHABLE as the callers stand — both resolve a real org first, and the
	// `--audit-run` path refuses a row with no `orgId` before it gets here. It
	// is kept as a second line rather than deleted because the failure it
	// prevents is a silent production write, and a future caller that resolves
	// the slug differently would not obviously know to re-derive this. Mutation
	// testing confirms nothing covers it; that is expected, not an oversight.
	if (!expected) {
		console.error('Refusing: no org slug to confirm against.');
		return false;
	}
	if (!process.stdin.isTTY) {
		console.error(
			'Refusing a non-dry-run against a remote database without an interactive confirmation.',
		);
		return false;
	}
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const typed = await rl.question(
			`This targets a REMOTE database. Type the org slug to continue (${expected}): `,
		);
		return typed.trim() === expected;
	} finally {
		rl.close();
	}
}

async function main() {
	const flags = parseFlags(process.argv.slice(2));
	const orgRef = readValue(flags, 'org');
	const auditRunId = readValue(flags, 'audit-run');
	const since = readValue(flags, 'since');
	const yes = readSwitch(flags, 'yes');
	const dryRun = readSwitch(flags, 'dry-run');

	// SAFETY: refuse rather than let one win. `--dry-run` was parsed and then
	// DISCARDED, so `--org acme --dry-run --yes` cleared notifiedAt — a live
	// write, causing real re-sends to real staff, from a command line that
	// visibly read `--dry-run`. Verified by execution during review. This is the
	// same defect CLAUDE.md records against the roster importer, and
	// `import-roster.ts` already refuses the combination; this script's own
	// docstring claimed to match its rails and did not.
	if (dryRun && yes) {
		console.error('--dry-run and --yes are mutually exclusive.');
		process.exit(1);
		return;
	}

	if (!orgRef && !auditRunId) {
		console.error('Usage: pnpm credentials:reset-notice --org <slug-or-id>');
		console.error('       pnpm credentials:reset-notice --audit-run <id>');
		process.exit(1);
	}
	if (orgRef && auditRunId) {
		console.error('--org and --audit-run are alternatives; pass one.');
		process.exit(1);
	}

	let credentialIds: string[];
	let orgSlug: string;
	let orgId: string;

	if (auditRunId) {
		// The audit row the notifier wrote alongside the stamp — the precise
		// blast radius of one org's pass in one run.
		const row = await prisma.auditLog.findUnique({
			where: { id: auditRunId },
			select: { action: true, orgId: true, metadata: true },
		});
		if (row?.action !== 'CREDENTIAL_EXPIRY_NOTICE_SENT') {
			console.error(
				`No CREDENTIAL_EXPIRY_NOTICE_SENT audit row with id ${auditRunId}`,
			);
			process.exit(1);
		}
		const meta = row.metadata as { credentialIds?: unknown } | null;
		credentialIds = Array.isArray(meta?.credentialIds)
			? (meta.credentialIds as string[])
			: [];
		if (!row.orgId) {
			// Without an org the blast radius is unknowable, and the remote
			// confirmation has nothing to check the typed slug against.
			console.error(
				`Audit row ${auditRunId} has no orgId; cannot scope this reset.`,
			);
			process.exit(1);
			return;
		}
		orgId = row.orgId;
		const org = await prisma.organization.findUnique({
			where: { id: orgId },
			select: { slug: true },
		});
		orgSlug = org?.slug ?? orgId;
	} else {
		const ref = orgRef as string;
		// id FIRST, as two unique lookups — an org can register another org's
		// cuid as its slug, and an unordered findFirst would pick the squatter.
		const org =
			(await prisma.organization.findUnique({
				where: { id: ref },
				select: { id: true, slug: true },
			})) ??
			(await prisma.organization.findUnique({
				where: { slug: ref },
				select: { id: true, slug: true },
			}));
		if (!org) {
			console.error(`No organization matching "${ref}"`);
			process.exit(1);
		}
		orgId = org.id;
		orgSlug = org.slug;
		const rows = await prisma.volunteerCredential.findMany({
			where: {
				orgId: org.id,
				notifiedAt: since ? { gte: new Date(since) } : { not: null },
			},
			select: { id: true },
		});
		credentialIds = rows.map((r) => r.id);
	}

	if (credentialIds.length === 0) {
		console.log('Nothing to reset — no stamped credentials matched.');
		return;
	}

	const affected = await prisma.volunteerCredential.findMany({
		where: { id: { in: credentialIds }, notifiedAt: { not: null } },
		select: {
			id: true,
			type: true,
			expiresAt: true,
			notifiedAt: true,
			user: { select: { name: true, email: true } },
		},
		orderBy: { expiresAt: 'asc' },
	});

	console.log(`Org: ${orgSlug} (${orgId})`);
	console.log(`Credentials to un-stamp: ${affected.length}`);
	for (const c of affected) {
		console.log(
			`  ${c.user.email ?? '(no email)'} — ${c.type} — expires ${c.expiresAt?.toISOString() ?? 'n/a'} — notified ${c.notifiedAt?.toISOString()}`,
		);
	}

	if (affected.length === 0) {
		console.log('All already un-stamped. Nothing to do.');
		return;
	}

	if (!yes) {
		console.log('\nDry run. Re-run with --yes to apply.');
		return;
	}

	const dbUrl = process.env.DATABASE_URL ?? '';
	if (!isLocalDatabaseUrl(dbUrl) && !(await confirmSlug(orgSlug))) {
		console.error('Confirmation did not match. Nothing was changed.');
		process.exit(1);
	}

	const { count } = await prisma.volunteerCredential.updateMany({
		where: { id: { in: affected.map((c) => c.id) } },
		data: { notifiedAt: null },
	});
	console.log(
		`\nUn-stamped ${count} credential(s). They re-enter the next nightly run.`,
	);
}

main()
	.catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
