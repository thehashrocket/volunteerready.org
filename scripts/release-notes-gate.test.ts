import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RELEASE_SEVERITY } from '../src/server/domain/release';
import {
	compareReleaseVersions,
	RELEASE_NOTE_MAX_LENGTH,
	RELEASE_NOTES,
} from '../src/server/domain/release-notes';

/**
 * Guards the properties of `RELEASE_NOTES` a machine can check, and — stated
 * first, because the sibling severity gate had to retract exactly this claim —
 * it does NOT check that a summary is any GOOD. No test can read
 * "Fixed an issue with the thing" and tell you a coordinator learned nothing.
 * That judgement is the author's.
 *
 * What it does check is the one failure that makes this whole feature pointless
 * while looking healthy: **a `notice` release with no note.** That ships the
 * interruption without the reason — precisely the "New version available, and
 * nothing else" defect this module was written to fix — and every other check
 * in the repo is green when it happens. `pnpm build`, `pnpm lint` and the full
 * suite pass with an empty `RELEASE_NOTES` and `RELEASE_SEVERITY = 'notice'`.
 *
 * Same class as `scripts/release-severity-gate.test.ts`, `lint-gate.test.ts`
 * and `ci-build-gate.test.ts`: a guard for a property the surrounding tooling
 * cannot see.
 *
 * IF YOU ARE HERE BECAUSE THIS WENT RED: you set `RELEASE_SEVERITY = 'notice'`.
 * Open `src/server/domain/release-notes.ts` and add one sentence at the top of
 * the array, keyed to this `VERSION`, saying what a coordinator can now do.
 * If you cannot write that sentence, the release is `silent`.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

/** Returns '' rather than throwing: a collection-time throw would take this
 * entire file out of the run, so a DELETED module would report zero failures —
 * the single most important case. `ci-build-gate.test.ts` learned this first. */
function readRepoText(relPath: string): string {
	try {
		return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
	} catch {
		return '';
	}
}

const notesSource = readRepoText('src/server/domain/release-notes.ts');
const versionFile = readRepoText('VERSION').trim();

describe('release notes module', () => {
	it('is readable at the path the rest of this guard assumes', () => {
		// Self-check. Every assertion below is vacuous if the file moved and
		// `readRepoText` quietly returned ''.
		expect(notesSource).not.toBe('');
		expect(notesSource).toContain('RELEASE_NOTES');
	});

	it('reads a non-empty VERSION file', () => {
		expect(versionFile).not.toBe('');
		expect(versionFile).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
	});
});

describe('a notice release explains itself', () => {
	it('has a note for the current VERSION when severity is notice', () => {
		// THE assertion this file exists for.
		if (RELEASE_SEVERITY !== 'notice') {
			// Deliberately not `it.skip`: a skipped test reads as "not applicable"
			// in the reporter, which is true, but recording the reason here keeps
			// the passing run honest about what was and was not checked.
			expect(RELEASE_SEVERITY).toBe('silent');
			return;
		}

		const match = RELEASE_NOTES.find((note) => note.version === versionFile);
		expect(
			match,
			`RELEASE_SEVERITY is 'notice' for ${versionFile} but RELEASE_NOTES has no entry for it. ` +
				'A notice with no summary is the defect this module exists to fix.',
		).toBeDefined();
	});
});

describe('release notes are well-formed', () => {
	it('found notes to check', () => {
		// Without this, every assertion below passes on an empty array forever —
		// the vacuous-guard trap this repo has been caught by before.
		expect(RELEASE_NOTES.length).toBeGreaterThan(0);
	});

	it('uses a full four-part version for every entry', () => {
		const malformed = RELEASE_NOTES.filter(
			(note) => !/^\d+\.\d+\.\d+\.\d+$/.test(note.version),
		);
		expect(malformed).toEqual([]);
	});

	it('names no version newer than the current release', () => {
		// A note for an unshipped version would be selected by `notesForRange`
		// the moment anyone's client sat below it, announcing a change that has
		// not happened.
		const ahead = RELEASE_NOTES.filter(
			(note) => (compareReleaseVersions(note.version, versionFile) ?? 0) > 0,
		);
		expect(ahead).toEqual([]);
	});

	it('lists each version at most once', () => {
		const versions = RELEASE_NOTES.map((note) => note.version);
		expect(versions).toEqual([...new Set(versions)]);
	});

	it('is sorted newest first', () => {
		// `notesForRange` sorts defensively, so this is not what makes the
		// function correct — it keeps the FILE readable, which is what makes the
		// next author paste their entry in the right place.
		const sorted = [...RELEASE_NOTES].sort(
			(a, b) => compareReleaseVersions(b.version, a.version) ?? 0,
		);
		expect(RELEASE_NOTES.map((n) => n.version)).toEqual(
			sorted.map((n) => n.version),
		);
	});

	it('keeps every summary short enough for a one-line strip', () => {
		// DESIGN.md's ambient notice strip is one line of body copy. A long
		// summary turns a 48px band into a paragraph, and nothing else notices.
		const tooLong = RELEASE_NOTES.filter(
			(note) => note.summary.length > RELEASE_NOTE_MAX_LENGTH,
		);
		expect(tooLong).toEqual([]);
	});

	it('ends every summary with terminal punctuation', () => {
		// The strip concatenates `{summary} Reload when you're ready — …`, so a
		// summary without a full stop renders as one run-on sentence.
		const unpunctuated = RELEASE_NOTES.filter(
			(note) => !/[.!?]$/.test(note.summary.trim()),
		);
		expect(unpunctuated).toEqual([]);
	});

	it('writes summaries in coordinator voice, not commit-message voice', () => {
		// Not a quality check — a shape check. A conventional-commit prefix is a
		// reliable tell that the CHANGELOG line was pasted in unedited, which is
		// the failure mode the module docstring warns about.
		const commitVoiced = RELEASE_NOTES.filter((note) =>
			/^(feat|fix|chore|ci|docs|refactor|test|perf)(\(|:)/i.test(
				note.summary.trim(),
			),
		);
		expect(commitVoiced).toEqual([]);
	});
});

/**
 * The notes describe the build being SERVED. A client that imported the array
 * would render its own, older build's copy — the notes for the release it is
 * already running. `import type` is fine: types are erased and carry no data,
 * and the update hook needs the shape to type its state.
 */
const CLIENT_DIRECTORIES = ['src/components', 'src/app', 'src/lib'];

/**
 * Strips comments so a docstring mentioning the module cannot trip the scan.
 * LINE comments first — a `//` containing `/*` (a glob, a URL) would otherwise
 * open a block the second pass never closes, swallowing real code into a false
 * pass. `version-route-gate.test.ts` and `error-disclosure.guard.test.ts` both
 * had to learn this ordering.
 */
function stripComments(text: string): string {
	return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * `[^;]*?` and NOT `[\s\S]*?`, which is the bug this matcher shipped with.
 *
 * A lazy any-character run crosses statement boundaries, so the match began at
 * the FIRST `import` in the file and reported group 1 as undefined — reading a
 * perfectly legal `import type` as a value import. It went unnoticed because
 * every fixture below was a single line; the multi-import fixture is the one
 * that reproduces it, and it is why that fixture exists.
 */
const NOTES_IMPORT =
	/import\s+(type\s+)?[^;]*?from\s+['"][^'"]*server\/domain\/release-notes['"]/g;

function valueImportsReleaseNotes(source: string): boolean {
	// A fresh RegExp per call: a shared /g literal carries `lastIndex` between
	// `matchAll` calls, so the second file scanned would silently start midway.
	const pattern = new RegExp(NOTES_IMPORT.source, 'g');
	return [...stripComments(source).matchAll(pattern)].some(
		(match) => match[1] === undefined,
	);
}

function isClientComponent(source: string): boolean {
	return /^\s*(['"])use client\1/m.test(source);
}

function walk(dir: string): string[] {
	const absolute = path.join(REPO_ROOT, dir);
	let entries: string[];
	try {
		entries = readdirSync(absolute);
	} catch {
		return [];
	}
	return entries.flatMap((entry) => {
		const relative = path.join(dir, entry);
		if (statSync(path.join(REPO_ROOT, relative)).isDirectory()) {
			return walk(relative);
		}
		return /\.tsx?$/.test(entry) ? [relative] : [];
	});
}

describe('release notes stay server-side as a value', () => {
	const clientFiles = CLIENT_DIRECTORIES.flatMap(walk).filter((file) =>
		isClientComponent(readRepoText(file)),
	);

	it('actually found client components to check', () => {
		expect(clientFiles.length).toBeGreaterThan(20);
	});

	it('distinguishes a value import from a type import', () => {
		// The matcher's own self-check. A regex that stops matching is
		// indistinguishable from a codebase with no violations — and here a
		// regex that matches TOO much would ban the legitimate type import the
		// update hook depends on, so both directions are pinned.
		expect(
			valueImportsReleaseNotes(
				`import { RELEASE_NOTES } from '@/server/domain/release-notes';`,
			),
		).toBe(true);
		expect(
			valueImportsReleaseNotes(
				`import { notesForRange } from '../../server/domain/release-notes';`,
			),
		).toBe(true);
		expect(
			valueImportsReleaseNotes(
				`import type { ReleaseNote } from '@/server/domain/release-notes';`,
			),
		).toBe(false);
		expect(
			valueImportsReleaseNotes(
				`import { RELEASE_SEVERITY } from '@/server/domain/release';`,
			),
		).toBe(false);
	});

	it('does not mistake a preceding import for the one it is judging', () => {
		// THE case the first draft of this matcher got wrong, and the reason
		// every fixture above is no longer enough on its own. With `[\s\S]*?`
		// the match starts at the `react` import, so the `type` group is
		// undefined and a legal type-only import reads as a value import —
		// which is how this guard failed against `use-app-update-check.ts`.
		expect(
			valueImportsReleaseNotes(
				[
					`import { useEffect } from 'react';`,
					`import { APP_VERSION } from '@/lib/app-version';`,
					`import type { ReleaseNote } from '@/server/domain/release-notes';`,
				].join('\n'),
			),
		).toBe(false);
	});

	it('still catches a value import sitting below other imports', () => {
		// The contrast test. Without it, a matcher narrowed until it matches
		// nothing would pass the case above and look correct.
		expect(
			valueImportsReleaseNotes(
				[
					`import { useEffect } from 'react';`,
					`import { RELEASE_NOTES } from '@/server/domain/release-notes';`,
				].join('\n'),
			),
		).toBe(true);
	});

	it('ignores the module named only inside a comment', () => {
		expect(
			valueImportsReleaseNotes(
				`// never import { RELEASE_NOTES } from '@/server/domain/release-notes'`,
			),
		).toBe(false);
	});

	it('is value-imported by no client component', () => {
		const offenders = clientFiles.filter((file) =>
			valueImportsReleaseNotes(readRepoText(file)),
		);
		expect(offenders).toEqual([]);
	});
});
