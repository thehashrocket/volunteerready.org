import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The route's WIRING, which nothing else executes.
 *
 * `scripts/version-route-gate.test.ts` reads this route as SOURCE TEXT — it
 * pins the import list, `force-dynamic` and the `no-store` header, and it
 * cannot see whether the handler actually does anything with them.
 * `release-notes.test.ts` covers the range logic as a pure function and never
 * touches HTTP. Between the two, the handler body itself — pulling `since` off
 * the query string and serialising the result — had no executing test at all.
 *
 * `notesForRange` is MOCKED here on purpose. Its behaviour is exhaustively
 * covered next to the implementation; what is unproven is that this route
 * hands it the caller's `since` and puts its answer on the wire. Mocking makes
 * that the only thing under test. It also sidesteps a trap: under vitest
 * `APP_VERSION` is '' (no `NEXT_PUBLIC_APP_VERSION`), so the real function
 * would correctly return an empty list for every input and each assertion
 * below would pass without proving anything.
 */

const notesForRange = vi.hoisted(() => vi.fn());

vi.mock('@/server/domain/release-notes', () => ({ notesForRange }));

const { GET } = await import('./route');

function get(url: string) {
	return GET(new Request(url));
}

beforeEach(() => {
	notesForRange.mockReset();
	notesForRange.mockReturnValue({ notes: [], olderCount: 0 });
});

describe('/api/version', () => {
	it('forwards the caller’s `since` to the range query', async () => {
		await get('http://localhost/api/version?since=0.41.11.0');
		expect(notesForRange).toHaveBeenCalledWith('0.41.11.0', expect.any(String));
	});

	it('passes null when the caller sends no `since`', async () => {
		// Not '' and not undefined: `notesForRange` distinguishes "no usable
		// since" from a real version, and it is the one place that decision is
		// made. Passing the wrong empty value here would route through a branch
		// the domain tests never exercise with this input.
		await get('http://localhost/api/version');
		expect(notesForRange).toHaveBeenCalledWith(null, expect.any(String));
	});

	it('does not confuse a different query parameter for `since`', async () => {
		await get('http://localhost/api/version?other=0.41.11.0');
		expect(notesForRange).toHaveBeenCalledWith(null, expect.any(String));
	});

	it('decodes a percent-encoded `since`', async () => {
		// The client encodes it; a handler reading the raw query string rather
		// than `searchParams` would hand the domain a still-encoded value.
		await get('http://localhost/api/version?since=0.41.11.0%20');
		expect(notesForRange).toHaveBeenCalledWith(
			'0.41.11.0 ',
			expect.any(String),
		);
	});

	it('serialises the notes and the dropped-note count onto the payload', async () => {
		notesForRange.mockReturnValue({
			notes: [{ version: '0.42.0.0', summary: 'A thing changed.' }],
			olderCount: 3,
		});

		const body = await (await get('http://localhost/api/version')).json();

		expect(body.notes).toEqual([
			{ version: '0.42.0.0', summary: 'A thing changed.' },
		]);
		// Reported, never silently dropped — a truncated list that looks
		// complete is the failure this key exists to prevent.
		expect(body.olderCount).toBe(3);
	});

	it('always answers with the identity fields a client compares against', async () => {
		const body = await (await get('http://localhost/api/version')).json();

		// `buildId` is the whole staleness signal. An empty one never equals a
		// client's, so a regression here prompts every user forever.
		expect(typeof body.buildId).toBe('string');
		expect(typeof body.version).toBe('string');
		expect(['silent', 'notice']).toContain(body.severity);
	});

	it('is uncacheable', async () => {
		// Duplicated from the source-text gate on purpose: that one proves the
		// string is present in the file, this one proves it reaches a response.
		const response = await get('http://localhost/api/version?since=0.41.0.0');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('answers 200 with JSON', async () => {
		const response = await get('http://localhost/api/version');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
	});
});
