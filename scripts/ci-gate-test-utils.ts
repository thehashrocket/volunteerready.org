/**
 * Shared parsing helpers for the `*-gate.test.ts` suite — guards over
 * `.github/workflows/ci.yml` config that the tool it configures cannot check
 * itself (same class as `scripts/lint-gate.test.ts`,
 * `scripts/docs-nav-links.test.ts`).
 *
 * Extracted from `ci-build-gate.test.ts` (`jobBlock`) and `e2e-ci-gate.test.ts`
 * (`jobBlock`, `stripYamlComments`) when `advisories-gate.test.ts` was about to
 * become a third/second copy respectively. Behavior is unchanged from those
 * originals — this is a pure move, not a rewrite.
 */

/**
 * Slice one job out of the workflow. Jobs sit at exactly two spaces of
 * indentation, so the next line matching that shape ends the block.
 *
 * Scoping matters: several steps (e.g. `pnpm prisma migrate deploy`) appear in
 * more than one job, so a whole-file `toContain` would pass with a job's own
 * steps deleted — which is exactly what a first, unscoped draft of
 * `ci-build-gate.test.ts` did.
 *
 * Returns `''` rather than throwing when the job is missing. That is
 * load-bearing: callers run this in a `describe` body, i.e. at COLLECTION
 * time, so a throw takes the whole file out of the run — and deleting a job
 * made the suite report fewer passing tests with every assertion silently
 * gone. An empty block makes each `it` fail on its own terms instead. Found
 * by mutation-testing `ci-build-gate.test.ts`, not by reading it.
 */
export function jobBlock(workflow: string, jobName: string): string {
	const lines = workflow.split('\n');
	const start = lines.indexOf(`  ${jobName}:`);
	if (start === -1) return '';

	// `[^#\s]` excludes comments: this workflow documents its jobs in 2-space
	// comment blocks, and one ending in a colon would otherwise read as the next
	// job and truncate the slice.
	const rest = lines.slice(start + 1);
	const relativeEnd = rest.findIndex((line) => /^ {2}[^#\s].*:\s*$/.test(line));
	const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
	return lines.slice(start, end).join('\n');
}

/**
 * Drop WHOLE-LINE `#` comments.
 *
 * Needed because this workflow explains itself at length, and prose naturally
 * names the very things these assertions forbid — the first draft of a
 * localhost check in `e2e-ci-gate.test.ts` went red against a comment saying
 * the guard needs no `E2E_ALLOW_REMOTE_DB`, which is the same false positive
 * `error-disclosure.guard.test.ts` and `plan-features.guard.test.ts` both had
 * to learn.
 *
 * Whole-line only, deliberately: a trailing-`#` strip would corrupt any quoted
 * value containing one — a password in a connection string, a `--health-cmd` —
 * and YAML gives no cheap way to tell a comment from a `#` inside quotes.
 */
export function stripYamlComments(yaml: string): string {
	return yaml
		.split('\n')
		.filter((line) => !/^\s*#/.test(line))
		.join('\n');
}
