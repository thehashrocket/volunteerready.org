/**
 * import-roster.ts — concierge roster import (T17).
 *
 * The "send us your spreadsheet" half of the roster launch. Loads a CSV of
 * volunteers onto one org's roster through `addVolunteer()`, the same service
 * the `/app/volunteers` add form calls — so shadow-user minting, the
 * first-writer-wins name rule, the `OrgVolunteerBlock` refusal and the audit row
 * all behave exactly as they do in the UI.
 *
 *   pnpm import:roster --org riverside-animal-shelter --file volunteers.csv --dry-run
 *   pnpm import:roster --org riverside-animal-shelter --file volunteers.csv --actor me@x.org --yes
 *
 * Expected columns (header row required, order irrelevant, spelling flexible —
 * see COLUMN_ALIASES in domain/roster-import.ts):
 *
 *   name,email,phone
 *
 * SAFETY
 * ------
 * A write run needs `--yes`. This is normally pointed at PRODUCTION, it emails
 * real people who never asked to hear from us, and email is the one part of it
 * that cannot be undone. `--dry-run` needs no confirmation and is the intended
 * first step every time.
 *
 * IDEMPOTENCE
 * -----------
 * Re-running the same file is safe and expected: a volunteer already on the live
 * roster comes back as a skip, not an error, and the run still exits 0. This is
 * what makes "fix the three bad rows and run it again" a normal thing to do
 * rather than a repair job.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Argument parsing — pure, exported for scripts/import-roster.test.ts
// ---------------------------------------------------------------------------

export type ImportArgs = {
	org: string;
	file: string;
	dryRun: boolean;
	notify: boolean;
	actor: string | null;
};

export class ArgError extends Error {}

/**
 * Flags that are switches: present or absent, never valued.
 *
 * SECURITY: this list exists because comparing `flags.get('dry-run') === true`
 * FAILS OPEN when the flag carries a value. `--dry-run=false --yes`,
 * `--dry-run=0 --yes` and `--dry-run false --yes` (the `--key value` branch
 * swallows the next bare token) all yielded `dryRun: false, yes: true` — a live
 * production write, emailing real people, from a command line that visibly
 * reads `--dry-run`. Verified before the fix. A valued switch is now a hard
 * error rather than a silently-false boolean.
 */
const SWITCH_FLAGS = ['dry-run', 'yes', 'no-notify'] as const;

export const USAGE = `Usage:
  pnpm import:roster --org <slug-or-id> --file <path.csv> [--dry-run] [--yes]
                     [--actor <email>] [--no-notify]

  --org        Organisation apply slug or id. Required.
  --file       Path to the CSV. Required. Needs "name" and "email" columns.
  --dry-run    Report what would happen and write nothing. Needs no --yes,
               and cannot be combined with it.
  --yes        Required to actually write.
  --actor      Email of the person to record as having added these volunteers.
               Omit and the audit rows carry no actor.
  --no-notify  Do NOT email the added volunteers. That email is the only thing
               telling them they were added, and it carries the only link to
               the page where they can revoke the org's access — so this leaves
               people on a roster with no notice. Intended for re-running an
               import whose notices already went out.

  Switches (--dry-run, --yes, --no-notify) take no value: --dry-run=false is
  an error, never a silently-disabled rehearsal.

Exit codes:
  0  every row added or skipped (re-running a file is all skips)
  1  any invalid row or failure, or a bad argument/org/actor/file`;

export function parseArgs(argv: readonly string[]): ImportArgs {
	const flags = new Map<string, string | true>();

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (!arg.startsWith('--')) {
			throw new ArgError(`Unexpected argument: ${arg}`);
		}

		// Both --key=value and --key value, because both get typed.
		const eq = arg.indexOf('=');
		if (eq !== -1) {
			flags.set(arg.slice(2, eq), arg.slice(eq + 1));
			continue;
		}

		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith('--')) {
			flags.set(key, next);
			i++;
		} else {
			flags.set(key, true);
		}
	}

	const known = new Set([
		'org',
		'file',
		'dry-run',
		'yes',
		'actor',
		'no-notify',
	]);
	for (const key of flags.keys()) {
		// A typo in a safety flag must not be silently ignored. `--dryrun` reading
		// as "no flags set" would turn an intended rehearsal into a live write.
		if (!known.has(key)) throw new ArgError(`Unknown flag: --${key}`);
	}

	const org = flags.get('org');
	if (typeof org !== 'string' || org.trim() === '') {
		throw new ArgError('--org is required.');
	}
	const file = flags.get('file');
	if (typeof file !== 'string' || file.trim() === '') {
		throw new ArgError('--file is required.');
	}

	const actor = flags.get('actor');
	if (actor === true) throw new ArgError('--actor needs an email address.');
	// Rejected as firmly as a bare `--actor`. An empty value would fall through
	// `if (args.actor)` below and attribute the import to nobody — exactly what
	// naming an actor was meant to prevent.
	if (actor === '') throw new ArgError('--actor needs an email address.');

	// Before reading any switch, so a valued switch cannot silently read false.
	for (const key of SWITCH_FLAGS) {
		if (typeof flags.get(key) === 'string') {
			throw new ArgError(`--${key} is a switch and takes no value.`);
		}
	}

	const dryRun = flags.get('dry-run') === true;
	const yes = flags.get('yes') === true;
	// Mutually exclusive rather than "dry-run wins". Both together means the
	// operator's intent is genuinely unclear, and guessing either way on a
	// production write is worse than making them retype it.
	if (dryRun && yes) {
		throw new ArgError('--dry-run and --yes are mutually exclusive.');
	}
	if (!dryRun && !yes) {
		throw new ArgError(
			'Refusing to write without --yes. Run with --dry-run first.',
		);
	}

	return {
		org: org.trim(),
		file: file.trim(),
		dryRun,
		notify: flags.get('no-notify') !== true,
		actor: typeof actor === 'string' ? actor.trim() : null,
	};
}

// ---------------------------------------------------------------------------
// Reporting — pure, exported for the test
// ---------------------------------------------------------------------------

const OUTCOME_LABEL = {
	ADDED: 'added',
	SKIPPED_ALREADY_ON_ROSTER: 'already on roster',
	REFUSED_BY_VOLUNTEER: 'REFUSED — volunteer revoked access',
	INVALID: 'INVALID',
	FAILED: 'FAILED',
} as const;

/**
 * One line per row, in file order, always — not just for failures.
 *
 * A bulk import that prints only what went wrong leaves the operator unable to
 * answer "did line 44 get in?" without querying the database, which is the
 * question §4 of the design doc says they were left with.
 */
export function formatResultLine(
	result: {
		line: number;
		email: string;
		outcome: keyof typeof OUTCOME_LABEL;
		message?: string;
	},
	dryRun: boolean,
): string {
	const verb =
		dryRun && result.outcome === 'ADDED' ? 'would add' : OUTCOME_LABEL[result.outcome];
	const suffix = result.message ? ` — ${result.message}` : '';
	return `  line ${String(result.line).padStart(4)}  ${result.email.padEnd(34)} ${verb}${suffix}`;
}

export function formatSummary(
	summary: Record<keyof typeof OUTCOME_LABEL, number>,
	dryRun: boolean,
): string {
	const rows: Array<[string, number]> = [
		[dryRun ? 'would add' : 'added', summary.ADDED],
		['already on roster', summary.SKIPPED_ALREADY_ON_ROSTER],
		['refused by volunteer', summary.REFUSED_BY_VOLUNTEER],
		['invalid rows', summary.INVALID],
		['failed', summary.FAILED],
	];
	return [
		'',
		...rows.map(([label, count]) => `  ${`${label}:`.padEnd(23)}${count}`),
	].join('\n');
}

/** Host of a Postgres URL, for the "you are about to write to X" preamble. */
export function describeDatabase(url: string | undefined): string {
	if (!url) return '(DATABASE_URL not set)';
	try {
		const parsed = new URL(url);
		return `${parsed.hostname}${parsed.pathname}`;
	} catch {
		return '(unparseable DATABASE_URL)';
	}
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
	const args = parseArgs(process.argv.slice(2));

	// Imported here, not at the top of the file. ESM hoists every static import
	// above the module body, so a top-level `import` of anything that reaches
	// `repositories/prisma` would evaluate — and throw on a missing DATABASE_URL
	// — before the `config()` call above ever runs.
	const { parseRosterCsv, RosterCsvFormatError, summarize, exitCodeFor } =
		await import('@/server/domain/roster-import');
	const { findOrgByIdOrSlug, userIsMemberOfOrg } = await import(
		'@/server/repositories/orgRepo',
	);
	const { findUserIdByEmail } = await import(
		'@/server/repositories/userAccountStateRepo'
	);
	const { prisma } = await import('@/server/repositories/prisma');
	const { importRoster, previewRosterImport, sendImportNotifications } =
		await import('@/server/services/rosterImportService');

	try {
		const org = await findOrgByIdOrSlug(args.org);
		if (!org) {
			console.error(`No organisation matches "${args.org}".`);
			process.exitCode = 1;
			return;
		}

		// Every other roster write path refuses a suspended org — `rosterProcedure`
		// inherits it from `orgProcedure`, and the CSV export enforces it through
		// `requireOrgAccess`. Bulk-loading eighty people into a suspended org and
		// emailing all of them is the same gap in the write direction.
		if (org.suspendedAt) {
			console.error(
				`${org.name} (${org.slug}) is suspended. Refusing to import.`,
			);
			process.exitCode = 1;
			return;
		}

		let actorId: string | null = null;
		if (args.actor) {
			actorId = await findUserIdByEmail(args.actor);
			if (!actorId) {
				// Not a warning. Silently attributing an import to nobody after the
				// operator explicitly named someone hides a typo in the one field
				// that says who did this.
				console.error(`No user has the address "${args.actor}".`);
				process.exitCode = 1;
				return;
			}
			// A typo that resolves to a REAL but unrelated address is worse than one
			// that resolves to nobody: it writes a confidently wrong audit trail and
			// the notice tells volunteers "Added by <a stranger>".
			if (!(await userIsMemberOfOrg(actorId, org.id))) {
				console.error(
					`"${args.actor}" is not a member of ${org.slug}. Refusing to attribute the import to them.`,
				);
				process.exitCode = 1;
				return;
			}
		}

		let parsed: ReturnType<typeof parseRosterCsv>;
		try {
			parsed = parseRosterCsv(readFileSync(args.file, 'utf8'));
		} catch (err) {
			if (err instanceof RosterCsvFormatError) {
				console.error(`Cannot read ${args.file}: ${err.message}`);
				process.exitCode = 1;
				return;
			}
			throw err;
		}

		console.log(
			[
				'',
				`  database:  ${describeDatabase(process.env.DATABASE_URL)}`,
				`  org:       ${org.name} (${org.slug})`,
				`  file:      ${args.file}`,
				`  actor:     ${args.actor ?? '(none — audit rows will have no actor)'}`,
				`  mode:      ${args.dryRun ? 'DRY RUN — nothing will be written' : 'WRITE'}`,
				`  notify:    ${args.dryRun || !args.notify ? 'no' : 'yes — added volunteers are emailed'}`,
				`  rows:      ${parsed.rows.length} valid, ${parsed.errors.length} invalid`,
				'',
			].join('\n'),
		);

		// Printed BEFORE anything is written, and in both modes. These rows are
		// known from the file alone, and an operator who is about to commit
		// should see what the run cannot read before it starts reading.
		const invalid = parsed.errors.map((e) => ({
			line: e.line,
			email: '',
			outcome: 'INVALID' as const,
			message: e.message,
		}));
		for (const r of invalid) console.log(formatResultLine(r, args.dryRun));

		const results = args.dryRun
			? await previewRosterImport({ orgId: org.id, rows: parsed.rows })
			: await importRoster({
					orgId: org.id,
					rows: parsed.rows,
					actorId,
					// The write run streams row by row, so a run killed partway still
					// leaves a record of exactly what committed. The preview has
					// nothing to lose by printing at the end.
					onRow: (r) => console.log(formatResultLine(r, false)),
				});

		if (args.dryRun) {
			for (const r of results) console.log(formatResultLine(r, true));
		}

		const summary = summarize([...results, ...invalid]);
		console.log(formatSummary(summary, args.dryRun));

		if (!args.dryRun && args.notify) {
			const { sent, failed } = await sendImportNotifications({
				orgId: org.id,
				actorId,
				results,
			});
			console.log(`\n  notifications sent:    ${sent}`);
			for (const f of failed) {
				console.error(`  notification FAILED:   ${f.email} — ${f.error}`);
			}
			// Roster rows are committed; an unsent notice is not a failed import.
			// It IS something a human has to act on, so it is never only a log line.
			if (failed.length > 0) {
				console.error(
					`\n  ${failed.length} volunteer(s) were added but not told. Re-send by hand.`,
				);
			}
		}

		if (args.dryRun) {
			console.log(
				'\n  Dry run: a rehearsal against the data as it stands now, not a' +
					'\n  guarantee. Re-run without --dry-run and with --yes to apply.',
			);
		}

		process.exitCode = exitCodeFor(summary);
	} finally {
		await prisma.$disconnect();
	}
}

// Only self-execute when run directly, so the test can import `parseArgs` and
// the formatters without opening a database connection.
const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	main().catch((err) => {
		if (err instanceof ArgError) {
			console.error(`${err.message}\n\n${USAGE}`);
		} else {
			console.error(err);
		}
		process.exitCode = 1;
	});
}
