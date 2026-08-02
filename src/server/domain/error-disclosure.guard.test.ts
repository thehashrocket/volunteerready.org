import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The one test that replaces ~74 per-site tests.
 *
 * T37 migrated every client surface that rendered a raw tRPC error message to
 * `safeErrorMessage()`/`safeCaughtErrorMessage()`. The sweep is uniform, which
 * is precisely what makes a PARTIAL sweep invisible — T35's recorded failure was
 * a grep returning "done" while three of four pages still leaked, because the
 * pages all looked alike. Per-site tests would not have caught that either; the
 * gap was a file nobody thought to test.
 *
 * So this asserts the property directly across the whole client tree, and every
 * exception has to be written down with a reason. A new leak is a red test, not
 * a code review someone has to remember to do.
 *
 * Scope is CLIENT code under `src/app` and `src/components`. `src/app/api/**`
 * is deliberately excluded: `errorFormatter` is configured on the tRPC instance,
 * so a Route Handler returning `NextResponse.json({ error })` never passes
 * through it. They are a different surface with different rules, and folding
 * them in here would make this test about two controls at once. That surface is
 * audited and currently clean — see "Route Handlers bypass `errorFormatter`" in
 * `docs/TODOS.md` for the per-file findings and the follow-up.
 */

const ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../..',
);

/**
 * A raw tRPC error message reaching a user.
 *
 * The alternation is wider than it first looks, and every branch is here
 * because a narrower version missed a spelling that actually occurs:
 *   - `err.message`, `error.message`, `query.error.message`
 *   - `err?.message` / `query.error?.message` — the optional-chain form, which
 *     is what `safeErrorMessage`'s own implementation uses, so it is the shape
 *     most likely to be copied into a new component
 *   - `e.message`, `ex.message` — short catch-variable names
 *   - `(err as TRPCError).message` — the cast form, which this very diff
 *     introduced in `invite/company/[token]/page.tsx` and the first draft of
 *     this regex could not see
 *
 * Deliberately does NOT match react-hook-form field errors
 * (`errors.name.message`, `form.formState.errors.x.message`) — those are
 * client-side Zod validation strings we authored, and they are safe. `\berror\b`
 * does not match `errors`, which is what keeps that carve-out working.
 *
 * `SELF_CHECK` below pins both halves, so narrowing this regex is a red test.
 */
const RAW_MESSAGE =
	/(?:\b\w*(?:[Ee]rr|ERR)(?:or|OR)?\b|\b(?:e|ex)\b|\.error|\.cause|\))[!?]?\.message\b|\berr(?:or)?\b\[['"]message['"]\]/;

/** Spellings the regex MUST catch, and safe ones it must NOT. */
const SELF_CHECK = {
	catches: [
		'toast.error(err.message)',
		'{query.error.message}',
		'{q.error?.message}',
		'const m = e.message;',
		'(err as TRPCError).message',
		'setError(err?.message)',
		// Every line below was MISSED by an earlier draft and found by an
		// adversarial pass, not by writing the regex more carefully. They are the
		// reason this list exists rather than a comment claiming coverage.
		'mutation.error!.message', // TS non-null assertion
		'queryError.message', // any renamed variable
		'fetchErr.message',
		'toast.error(err.cause.message)', // the laundering idiom itself
		'err["message"]', // bracket access
	],
	ignores: [
		'{errors.name.message}',
		'{form.formState.errors.title.message}',
		'<p>{item.message}</p>',
		'setLastResult({ message: lastResult.message })',
		'const { message } = payload',
		'issues.map((i) => i.message)',
	],
} as const;

/**
 * Every exception, with the reason it is not a tRPC disclosure. Anything not
 * listed here that matches is a failure. Keep this list SHORT — if it grows,
 * the rule is being eroded rather than followed.
 */
const ALLOWED: Record<string, { matches: number; why: string }> = {
	'app/(app)/app/admin/platform/catalog/screener-defaults/_components/question-form.tsx':
		{
			matches: 1,
			why: "JSON.parse failure on the admin's own textarea input — not a tRPC error, and they need to read it to fix their JSON",
		},
	'app/(app)/app/admin/platform/users/[id]/page.tsx': {
		matches: 1,
		why: 'raw fetch() to /api/platform-admin/impersonation/start, which applies its own allowlist server-side before returning a message',
	},
	'app/(public)/screening/feedback/actions.ts': {
		matches: 1,
		why: 'server action return value consumed for logging, never rendered',
	},
	'components/app/query-error-card.tsx': {
		matches: 1,
		why: 'the implementation of the allowlist itself — `safeErrorMessage` reads `error?.message` in order to decide whether to return it',
	},
	'app/invite/company/[token]/page.tsx': {
		matches: 1,
		why: 'Server Component: reads the message only inside an isClientSafeErrorCode branch before putting it in a redirect URL',
	},
};

/** Walk the client tree. No glob dependency — a guard test should not add one. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(path.join(ROOT, dir), {
		withFileTypes: true,
	})) {
		const rel = `${dir}/${entry.name}`;
		// Route Handlers never reach errorFormatter — different surface, own rules.
		if (rel === 'app/api') continue;
		if (entry.isDirectory()) {
			sourceFiles(rel, acc);
		} else if (
			/\.tsx?$/.test(entry.name) &&
			!/\.test\.tsx?$/.test(entry.name)
		) {
			acc.push(rel);
		}
	}
	return acc;
}

/**
 * Line comments are stripped FIRST, and the order is load-bearing.
 *
 * A `//` comment mentioning a glob like `src/app/api/` + `**` contains `/*`, so
 * running the block-comment pass first starts a "comment" there and swallows
 * every line up to the next `*​/` — six real lines, in the case that caught
 * this. The guard then reported zero matches for a file that had one, and the
 * only reason it surfaced is that the ALLOWED budget said otherwise. Without
 * that budget it would have been a silent hole in the control.
 */
function stripComments(source: string): string {
	// Block comments are replaced by their own newlines rather than deleted, so
	// line numbers still point at real code — a violation reported 70 lines off
	// is a bisect, not a fix.
	const keepLines = (m: string) => '\n'.repeat((m.match(/\n/g) ?? []).length);
	return source
		.replace(/^\s*\/\/.*$/gm, '')
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, keepLines)
		.replace(/\/\*[\s\S]*?\*\//g, keepLines);
}

/** Server tree too — the 18 converted refusals all live under `src/server`. */
function serverFiles(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(path.join(ROOT, dir), {
		withFileTypes: true,
	})) {
		const rel = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			serverFiles(rel, acc);
		} else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
			acc.push(rel);
		}
	}
	return acc;
}

/** A `new TRPCError({...})` literal carrying both `message:` and `cause:`. */
const TRPC_ERROR_LITERAL = /new TRPCError\(\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\)/g;

function scanForMessageWithCause(rel: string, offenders: string[]): void {
	const body = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'));
	for (const match of body.matchAll(TRPC_ERROR_LITERAL)) {
		const args = match[1] ?? '';
		if (/\bmessage\s*:/.test(args) && /\bcause\s*:/.test(args)) {
			const line = body.slice(0, match.index).split('\n').length;
			offenders.push(`${rel}:${line}`);
		}
	}
}

describe('SECURITY: no raw tRPC error message reaches a client surface', () => {
	it('every match is either migrated or an explained exception', () => {
		const files = [...sourceFiles('app'), ...sourceFiles('components')];

		// Sanity: a glob that silently matched nothing would make this pass
		// vacuously forever.
		expect(files.length).toBeGreaterThan(100);

		const violations: string[] = [];

		for (const rel of files) {
			const body = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'));
			const hits = body
				.split('\n')
				.map((line, i) => ({ line: line.trim(), n: i + 1 }))
				.filter(({ line }) => RAW_MESSAGE.test(line));
			if (hits.length === 0) continue;

			// Exemptions are per-FILE but budgeted, so a second, unrelated leak
			// added to an already-exempt file still fails. Without the count, the
			// one legitimate `fetch()` line in `admin/platform/users/[id]` would
			// have silently covered the two tRPC mutations that live beside it.
			const allowed = ALLOWED[rel]?.matches ?? 0;
			if (hits.length <= allowed) continue;

			for (const { line, n } of hits.slice(allowed)) {
				violations.push(`${rel}:${n}  ${line}`);
			}
		}

		expect(
			violations,
			`Raw tRPC error message(s) reaching a user surface. Route them through ` +
				`safeErrorMessage() / safeCaughtErrorMessage() from ` +
				`@/components/app/query-error-card, or add an entry to ALLOWED in ` +
				`this file explaining why the value is not a tRPC error:\n` +
				violations.join('\n'),
		).toEqual([]);
	});

	it('every ALLOWED entry still exists and still matches its budget', () => {
		// A stale exception is worse than none: it reads as "we checked this"
		// while silently permitting whatever moves into that path later.
		for (const [rel, { matches }] of Object.entries(ALLOWED)) {
			const body = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'));
			const hits = body.split('\n').filter((l) => RAW_MESSAGE.test(l)).length;
			expect(hits, `${rel} — ALLOWED says ${matches}, found ${hits}`).toBe(
				matches,
			);
		}
	});

	it('SECURITY: no TRPCError passes both `message` and `cause`', () => {
		// `errorFormatter` infers "we authored this" from the ABSENCE of an Error
		// cause. That invariant holds today and is enforced by nothing else: the
		// natural wrapping idiom
		//
		//   throw new TRPCError({ code: 'BAD_REQUEST', message: 'That CSV is
		//     malformed.', cause: err })
		//
		// silently degrades hand-written copy to the generic string — no type
		// error, no lint, and the message-based tests still pass. Same failure
		// shape as the plain-`Error` hazard T37 exists to close, one level up.
		const offenders: string[] = [];

		for (const rel of [...sourceFiles('app'), ...sourceFiles('components')]) {
			scanForMessageWithCause(rel, offenders);
		}
		for (const rel of serverFiles('server')) {
			scanForMessageWithCause(rel, offenders);
		}

		expect(
			offenders,
			`A TRPCError carrying BOTH \`message\` and \`cause\` has its message ` +
				`redacted, because errorFormatter treats an Error cause as "not ` +
				`authored by us". Drop the cause (log it instead), or drop the ` +
				`message and let the generic copy stand:\n${offenders.join('\n')}`,
		).toEqual([]);
	});

	it('SELF-CHECK: the detector catches every spelling it claims to', () => {
		// Without this, narrowing RAW_MESSAGE would make the whole guard pass
		// vacuously — which is exactly what happened on the first draft, where
		// `err?.message` and `(err as TRPCError).message` slipped through.
		for (const sample of SELF_CHECK.catches) {
			expect(RAW_MESSAGE.test(sample), `should catch: ${sample}`).toBe(true);
		}
		for (const sample of SELF_CHECK.ignores) {
			expect(RAW_MESSAGE.test(sample), `should ignore: ${sample}`).toBe(false);
		}
	});
});
