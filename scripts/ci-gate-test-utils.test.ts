import { describe, expect, it } from 'vitest';
import { jobBlock, stripYamlComments } from './ci-gate-test-utils';

/**
 * Direct unit tests for the two helpers extracted from `ci-build-gate.test.ts`
 * and `e2e-ci-gate.test.ts` into this shared module. Before the extraction,
 * every `*-gate.test.ts` consumer only ever called these against the real,
 * current `ci.yml` — always with a job name that exists and comments that
 * never happen to defeat the stripper. That leaves two branches unexercised
 * by any test in the repo: `jobBlock`'s "job not found" `''` return (its own
 * docstring calls this load-bearing, found by mutation-testing, not by
 * reading) and `stripYamlComments`' "only a line STARTING with `#` is
 * dropped" rule (the trailing-`#`-inside-a-value case its docstring warns
 * about). Now that the helpers live in one standalone module, they get their
 * own fixture strings instead of depending on `ci.yml` happening to contain
 * a case that exercises them.
 */

describe('jobBlock', () => {
	const workflow = [
		'name: CI',
		'',
		'jobs:',
		'  first:',
		'    name: First job',
		'    runs-on: ubuntu-latest',
		'    steps:',
		'      - run: echo one',
		'  second:',
		'    name: Second job',
		'    steps:',
		'      - run: echo two',
	].join('\n');

	it('slices out the named job, stopping before the next job', () => {
		const block = jobBlock(workflow, 'first');

		expect(block).toContain('name: First job');
		expect(block).toContain('echo one');
		expect(block).not.toContain('Second job');
		expect(block).not.toContain('echo two');
	});

	it('returns everything to end-of-file for the last job', () => {
		const block = jobBlock(workflow, 'second');

		expect(block).toContain('name: Second job');
		expect(block).toContain('echo two');
	});

	it('returns an empty string for a job that does not exist', () => {
		// Load-bearing per the source docstring: this runs at `describe`-body
		// COLLECTION time in every consumer, so throwing here would silently
		// drop the whole file's assertions instead of failing each `it` on
		// its own terms.
		expect(jobBlock(workflow, 'does-not-exist')).toBe('');
	});

	it('does not treat a comment line ending in a colon as the next job', () => {
		const withCommentColon = [
			'jobs:',
			'  first:',
			'    steps:',
			'      # note: this looks like a job header but is not',
			'      - run: echo one',
			'  second:',
			'    steps:',
			'      - run: echo two',
		].join('\n');

		const block = jobBlock(withCommentColon, 'first');

		expect(block).toContain('echo one');
		expect(block).not.toContain('echo two');
	});
});

describe('stripYamlComments', () => {
	it('drops a whole-line comment', () => {
		const yaml = ['first:', '  # a comment line', '  value: 1'].join('\n');

		const stripped = stripYamlComments(yaml);

		expect(stripped).not.toContain('a comment line');
		expect(stripped).toContain('value: 1');
	});

	it('drops an indented comment line', () => {
		const yaml = ['jobs:', '      # indented comment', '      - run: x'].join(
			'\n',
		);

		const stripped = stripYamlComments(yaml);

		expect(stripped).not.toContain('indented comment');
		expect(stripped).toContain('- run: x');
	});

	it('does NOT strip a line that merely contains a # after real content', () => {
		// The exact hazard the docstring names: a trailing-# strip would
		// corrupt a quoted value containing one (a password, a --health-cmd).
		// Whole-line-only means a line not STARTING with `#` survives intact.
		const yaml = '- run: echo "value # not a comment"';

		expect(stripYamlComments(yaml)).toBe(yaml);
	});

	it('preserves non-comment lines unchanged, including indentation', () => {
		const yaml = ['  first:', '    steps:', '      - run: echo one'].join('\n');

		expect(stripYamlComments(yaml)).toBe(yaml);
	});
});
