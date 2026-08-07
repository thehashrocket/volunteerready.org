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
	for (const arg of argv) {
		if (!arg.startsWith('--')) {
			throw new Error(`Unexpected positional argument: ${arg}`);
		}
		const [rawName, ...rest] = arg.slice(2).split('=');
		const name = rawName ?? '';
		if (!KNOWN_FLAGS.has(name)) {
			throw new Error(`Unknown flag: --${name}`);
		}
		if (flags.has(name)) {
			throw new Error(`Flag --${name} given more than once`);
		}
		flags.set(name, rest.length > 0 ? rest.join('=') : true);
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
	return value;
}

async function confirmSlug(expected: string): Promise<boolean> {
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
	readSwitch(flags, 'dry-run'); // accepted for symmetry; dry run is the default

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
		orgId = row.orgId ?? '';
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
