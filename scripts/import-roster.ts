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
 * Against a non-local `DATABASE_URL` a write additionally requires the org's
 * RESOLVED slug typed back at an interactive prompt. `--yes` alone cannot catch
 * the failure that matters here — a mistyped or duplicated `--org` naming a real
 * but wrong organisation — because the command line looks exactly as intended.
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
	/** Send the notices an earlier run left owed. Adds nobody. */
	notifyOnly: boolean;
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
const SWITCH_FLAGS = ['dry-run', 'yes', 'no-notify', 'notify-only'] as const;

export const USAGE = `Usage:
  pnpm import:roster --org <slug-or-id> --file <path.csv> [--dry-run] [--yes]
                     [--actor <email>] [--no-notify] [--notify-only]

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
               people on a roster with no notice. Prefer --notify-only for
               re-running an import whose notices already went out: it skips
               the ones that did rather than skipping all of them.
  --notify-only
               Add nobody; send the notices an earlier run left owed. Feed it
               the SAME file. Each row is matched against this org's own
               concierge-import audit rows, so it can only ever mail people a
               previous run of this importer actually added, and each notice is
               attributed to whoever that run recorded. Combine with --dry-run
               to list the recipients without sending.

  Switches (--dry-run, --yes, --no-notify, --notify-only) take no value:
  --dry-run=false is an error, never a silently-disabled rehearsal. No flag may
  be given twice — a repeat is refused rather than resolved to the last one.

  Against a non-local DATABASE_URL a write also asks you to type the org's
  resolved slug. --dry-run never does.

Exit codes:
  0  every row added or skipped (re-running a file is all skips)
  1  any invalid row or failure, or a bad argument/org/actor/file

  With --notify-only, 1 means a notice failed to send or an audit row could
  not be read. A row nobody ever added is reported but is NOT an error — it is
  the normal shape of re-feeding a file that was interrupted partway.`;

export function parseArgs(argv: readonly string[]): ImportArgs {
	const flags = new Map<string, string | true>();

	// SECURITY: a repeated flag last-wins in a Map, silently. `--org good-org
	// --org squatter --yes` resolved to the SECOND one, so a single mistyped or
	// duplicated slug wrote shadow users into a stranger's tenant and emailed
	// them, from a command line that visibly names the right org. Checked for
	// EVERY flag rather than just the switches: this is a distinct failure from
	// the valued-switch check below, and either one alone leaves a hole.
	const setFlag = (key: string, value: string | true) => {
		if (flags.has(key)) {
			throw new ArgError(
				`--${key} was given more than once. Repeated flags are refused rather than resolved.`,
			);
		}
		flags.set(key, value);
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (!arg.startsWith('--')) {
			throw new ArgError(`Unexpected argument: ${arg}`);
		}

		// Both --key=value and --key value, because both get typed.
		const eq = arg.indexOf('=');
		if (eq !== -1) {
			setFlag(arg.slice(2, eq), arg.slice(eq + 1));
			continue;
		}

		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith('--')) {
			setFlag(key, next);
			i++;
		} else {
			setFlag(key, true);
		}
	}

	const known = new Set([
		'org',
		'file',
		'dry-run',
		'yes',
		'actor',
		'no-notify',
		'notify-only',
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

	const notifyOnly = flags.get('notify-only') === true;
	const notify = flags.get('no-notify') !== true;

	// Contradictory rather than merely redundant: one says "send the notices an
	// earlier run left owed", the other says "send nothing". Guessing either way
	// is worse than a retype, and silently preferring one would make a run that
	// LOOKS like a recovery send nothing at all.
	if (notifyOnly && !notify) {
		throw new ArgError('--notify-only and --no-notify are mutually exclusive.');
	}

	// `--actor` names who to attribute an ADD to, and --notify-only adds nobody.
	// Attribution for a resent notice comes from the audit row of the original
	// run, so accepting this flag here would either be ignored or would rewrite
	// history — telling volunteers they were added by whoever is running the
	// recovery today.
	if (notifyOnly && typeof actor === 'string') {
		throw new ArgError(
			'--actor has no meaning with --notify-only: each notice is attributed to whoever the original run recorded.',
		);
	}

	return {
		org: org.trim(),
		file: file.trim(),
		dryRun,
		notify,
		actor: typeof actor === 'string' ? actor.trim() : null,
		notifyOnly,
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

const NOTIFY_ONLY_LABEL = {
	OWED: 'owed — will send',
	SENT: 'sent',
	FAILED: 'FAILED',
	ALREADY_SENT: 'already sent — skipped',
	REFUSED_BY_VOLUNTEER: 'REFUSED — volunteer revoked access',
	INELIGIBLE_OUTCOME: 'no notice was ever owed',
	NOT_COMMITTED: 'not added by an import — nothing to send',
	MALFORMED_AUDIT_ROW: 'UNKNOWN — audit row unreadable',
	/**
	 * Script-only. A row the FILE cannot express, as opposed to one the database
	 * has nothing for — its own status rather than borrowed `NOT_COMMITTED`,
	 * which would print a line the summary then counted under a different label.
	 */
	INVALID: 'INVALID',
} as const;

/** One line per row of a `--notify-only` run, same shape as the import's. */
export function formatNotifyOnlyLine(row: {
	line: number;
	email: string;
	status: keyof typeof NOTIFY_ONLY_LABEL;
	error?: string;
}): string {
	const verb = NOTIFY_ONLY_LABEL[row.status];
	const suffix = row.error ? ` — ${row.error}` : '';
	return `  line ${String(row.line).padStart(4)}  ${row.email.padEnd(34)} ${verb}${suffix}`;
}

export function formatNotifyOnlySummary(
	summary: Record<keyof typeof NOTIFY_ONLY_LABEL, number>,
	dryRun: boolean,
): string {
	// `owed` is a DRY-RUN-ONLY line. After a real run every owed row has become
	// SENT or FAILED, so `summary.OWED` is necessarily 0 — printing it would put
	// `owed: 0` directly above `sent: 1` and tell the operator nothing was owed on
	// the very run that found and sent an owed notice.
	const rows: Array<[string, number]> = [
		...(dryRun
			? ([['would send', summary.OWED]] as Array<[string, number]>)
			: ([
					['sent', summary.SENT],
					['failed', summary.FAILED],
				] as Array<[string, number]>)),
		['already sent', summary.ALREADY_SENT],
		['refused by volunteer', summary.REFUSED_BY_VOLUNTEER],
		['never owed a notice', summary.INELIGIBLE_OUTCOME],
		['not added by an import', summary.NOT_COMMITTED],
		['unreadable audit rows', summary.MALFORMED_AUDIT_ROW],
		['invalid rows', summary.INVALID],
	];
	// Wider than the import summary's 23: `not added by an import:` is longer
	// than any label there, and an unpadded column reads as a formatting bug on
	// exactly the line an operator is trying to interpret.
	return [
		'',
		...rows.map(([label, count]) => `  ${`${label}:`.padEnd(25)}${count}`),
	].join('\n');
}

export function summarizeNotifyOnly(
	rows: readonly { status: keyof typeof NOTIFY_ONLY_LABEL }[],
): Record<keyof typeof NOTIFY_ONLY_LABEL, number> {
	const summary = {
		OWED: 0,
		SENT: 0,
		FAILED: 0,
		ALREADY_SENT: 0,
		REFUSED_BY_VOLUNTEER: 0,
		INELIGIBLE_OUTCOME: 0,
		NOT_COMMITTED: 0,
		MALFORMED_AUDIT_ROW: 0,
		INVALID: 0,
	};
	for (const r of rows) summary[r.status]++;
	return summary;
}

export function describeMode(args: {
	dryRun: boolean;
	notifyOnly: boolean;
}): string {
	if (args.notifyOnly) {
		return args.dryRun
			? 'DRY RUN — notify-only; nothing will be sent'
			: 'NOTIFY ONLY — sends owed notices, adds nobody';
	}
	return args.dryRun ? 'DRY RUN — nothing will be written' : 'WRITE';
}

export function describeNotify(args: {
	dryRun: boolean;
	notify: boolean;
	notifyOnly: boolean;
}): string {
	if (args.dryRun) return 'no';
	if (args.notifyOnly) return 'yes — this run is nothing but notices';
	return args.notify ? 'yes — added volunteers are emailed' : 'no';
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

/**
 * A FOURTH copy of the host set in `e2e/utils/db.ts`,
 * `src/test/integration-setup.ts` and `scripts/seed-email-collision-fixture.ts`.
 *
 * This is deferred debt, not a justified duplication — recorded plainly rather
 * than argued away. The four sites differ in what they DO about a non-local
 * database (two refuse with an env-var override, one refuses outright, this one
 * prompts), but the set and the hostname test are byte-identical, and by this
 * repo's own `escapeCsvField` precedent one copy too many is where a copy stops
 * being maintained. The right fix is to extract the predicate alone and migrate
 * all four; that reaches into the e2e and integration harnesses, which is a
 * different diff from hardening this script. Tracked as a P3 in docs/TODOS.md.
 *
 * `new URL().hostname` keeps the brackets on an IPv6 literal, hence both forms.
 */
const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * True only when the URL names a host we recognise as local.
 *
 * Fails CLOSED — a missing or unparseable URL is treated as NOT local, so it
 * gets the confirmation prompt. Guessing "this is probably a dev box" about a
 * database this cannot even identify is the wrong direction to be wrong in for a
 * check that gates a live write.
 */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		return LOCAL_DB_HOSTS.has(new URL(url).hostname);
	} catch {
		return false;
	}
}

/**
 * Make the operator type the org's slug before a non-local write.
 *
 * `--yes` was the entire gate on a script whose own header says it is normally
 * pointed at production, while every other database-touching thing in this repo
 * REFUSES a non-local `DATABASE_URL` outright. The importer cannot simply refuse
 * — production is where it is meant to run — so it asks for the one thing a
 * mistyped run cannot produce: the resolved slug of the org it is about to write
 * to, echoed back by a human who has read it.
 *
 * `isTTY` and `readAnswer` are PARAMETERS, not reads of `process.stdin`, so both
 * branches are unit-testable — `main()` is never invoked by any test, and a
 * confirmation prompt nothing exercises is a confirmation prompt that breaks
 * silently.
 */
export async function requireProductionConfirmation(input: {
	orgSlug: string;
	databaseLabel: string;
	isTTY: boolean;
	readAnswer: () => Promise<string>;
	/** A notify-only run writes no rows, so its refusals must not say it does. */
	notifyOnly?: boolean;
}): Promise<void> {
	const verb = input.notifyOnly ? 'send from' : 'write to';
	const undone = input.notifyOnly ? 'Nothing was sent.' : 'Nothing was written.';

	if (!input.isTTY) {
		// No fallback and no env-var override. `E2E_ALLOW_REMOTE_DB` exists
		// because CI genuinely needs to point at a shared database; this script
		// has no automated caller, so a bypass would just reinstate the gap.
		throw new ArgError(
			`Refusing to ${verb} "${input.databaseLabel}" — that is not a local database, ` +
				'and there is no terminal here to confirm it.\n' +
				'Run it from an interactive shell, or rehearse with --dry-run.',
		);
	}

	const typed = (await input.readAnswer()).trim();
	if (typed !== input.orgSlug) {
		throw new ArgError(`That is not "${input.orgSlug}". ${undone}`);
	}
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/**
 * Read one line from the real stdin. The only untested part of the confirmation
 * — `requireProductionConfirmation` takes this as a parameter for that reason.
 */
async function promptLine(question: string): Promise<string> {
	const { createInterface } = await import('node:readline/promises');
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	// Imported here, not at the top of the file. ESM hoists every static import
	// above the module body, so a top-level `import` of anything that reaches
	// `repositories/prisma` would evaluate — and throw on a missing DATABASE_URL
	// — before the `config()` call above ever runs.
	const {
		parseRosterCsv,
		RosterCsvFormatError,
		summarize,
		exitCodeFor,
		notifyOnlyExitCode,
	} = await import('@/server/domain/roster-import');
	const { findOrgByIdOrSlug, userIsMemberOfOrg } = await import(
		'@/server/repositories/orgRepo',
	);
	const { findUserIdByEmail } = await import(
		'@/server/repositories/userAccountStateRepo'
	);
	const { prisma } = await import('@/server/repositories/prisma');
	const {
		classifyOwedNotices,
		importRoster,
		previewRosterImport,
		sendImportNotifications,
		sendOwedNotices,
	} = await import('@/server/services/rosterImportService');

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

		// AFTER the org is resolved, because the slug the operator has to type is
		// the RESOLVED one — `--org` accepts an id too, and asking them to retype
		// what they already typed confirms nothing. Before the file is read, so a
		// run aimed at the wrong database is stopped without touching anything.
		if (!args.dryRun && !isLocalDatabaseUrl(process.env.DATABASE_URL)) {
			const databaseLabel = describeDatabase(process.env.DATABASE_URL);
			console.log(
				[
					'',
					`  ${databaseLabel} is not a local database.`,
					// A notify-only run writes no rows. Saying it does here would
					// contradict the `mode:` line two lines above, which a test pins
					// specifically so this run is never described as a WRITE.
					args.notifyOnly
						? `  This emails real volunteers at ${org.name}. No rows are written.`
						: `  This writes rows and emails real volunteers at ${org.name}.`,
					'',
				].join('\n'),
			);
			await requireProductionConfirmation({
				orgSlug: org.slug,
				databaseLabel,
				notifyOnly: args.notifyOnly,
				isTTY: process.stdin.isTTY === true,
				readAnswer: () => promptLine(`  Type "${org.slug}" to continue: `),
			});
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
				`  actor:     ${args.actor ?? (args.notifyOnly ? '(from each original audit row)' : '(none — audit rows will have no actor)')}`,
				`  mode:      ${describeMode(args)}`,
				`  notify:    ${describeNotify(args)}`,
				`  rows:      ${parsed.rows.length} valid, ${parsed.errors.length} invalid`,
				'',
			].join('\n'),
		);

		if (args.notifyOnly) {
			// Invalid rows are reported and then dropped: an address this file
			// cannot parse is one no earlier run can have added either, so there is
			// nothing owed to it. Printed all the same — a silently ignored row is
			// how an operator concludes a recovery covered more than it did.
			const invalidRows = parsed.errors.map((e) => ({
				line: e.line,
				email: '',
				status: 'INVALID' as const,
				error: e.message,
			}));
			for (const r of invalidRows) console.log(formatNotifyOnlyLine(r));

			const { orgName, rows } = args.dryRun
				? await classifyOwedNotices({ orgId: org.id, rows: parsed.rows })
				: await sendOwedNotices({
						orgId: org.id,
						rows: parsed.rows,
						// Streamed, for the same reason the write run streams: at 600ms a
						// batch is minutes of output, and a run killed during it must
						// leave a record of which notices already went.
						onSend: (r) => console.log(formatNotifyOnlyLine(r)),
					});

			if (orgName === null) {
				console.error(`\n  ${org.name} could not be resolved. Nothing was sent.`);
				process.exitCode = 1;
				return;
			}

			// The dry run prints everything at the end. The write run has already
			// streamed every row it ATTEMPTED (each one is now SENT or FAILED), so
			// it prints only the rows it never attempted — otherwise every send
			// appears twice.
			for (const r of rows) {
				const streamed =
					!args.dryRun && (r.status === 'SENT' || r.status === 'FAILED');
				if (!streamed) console.log(formatNotifyOnlyLine(r));
			}

			const summary = summarizeNotifyOnly([...rows, ...invalidRows]);
			console.log(formatNotifyOnlySummary(summary, args.dryRun));

			if (summary.FAILED > 0) {
				console.error(
					`\n  ${summary.FAILED} volunteer(s) are still not told. Re-run --notify-only, or send by hand.`,
				);
			}
			if (summary.MALFORMED_AUDIT_ROW > 0) {
				console.error(
					`\n  ${summary.MALFORMED_AUDIT_ROW} audit row(s) could not be read, so whether a notice is owed is unknown.`,
				);
			}
			if (args.dryRun) {
				console.log(
					'\n  Dry run: nothing was sent. Re-run with --notify-only --yes to send.',
				);
			}

			process.exitCode = notifyOnlyExitCode(summary);
			return;
		}

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
			console.log('');
			const { sent, failed } = await sendImportNotifications({
				orgId: org.id,
				actorId,
				results,
				// Streamed as each one lands. The loop paces at 600ms, so a 60-row
				// batch was 36 seconds of total silence after the rows had finished
				// printing — which is what invites the Ctrl-C that leaves rows
				// committed and notices unsent, the exact state --notify-only exists
				// to repair.
				onSend: (r) =>
					console.log(
						r.status === 'SENT'
							? `  notice sent:           ${r.email}`
							: `  notice FAILED:         ${r.email} — ${r.error}`,
					),
			});
			console.log(`\n  notifications sent:    ${sent}`);
			// Roster rows are committed; an unsent notice is not a failed import.
			// It IS something a human has to act on, so it is never only a log line.
			if (failed.length > 0) {
				console.error(
					`\n  ${failed.length} volunteer(s) were added but not told.` +
						'\n  Re-send them with the same file and --notify-only --yes.',
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
