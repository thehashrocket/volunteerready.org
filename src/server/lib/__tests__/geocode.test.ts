import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for src/server/lib/geocode.ts
// Covers: cleanLocation (via geocodeLocation side-effects), geocodeLocation
// branch matrix, and getGeocodeApiKey.
// ---------------------------------------------------------------------------

// We mock global fetch; the module is re-imported fresh in each describe block
// that needs a different OPENCAGE_API_KEY value.

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper — build a minimal OpenCage-shaped response
function okResponse(lat: number, lng: number, statusCode = 200) {
	return {
		ok: true,
		json: async () => ({
			status: { code: statusCode },
			results: [{ geometry: { lat, lng } }],
		}),
	};
}

function emptyResultResponse() {
	return {
		ok: true,
		json: async () => ({
			status: { code: 200 },
			results: [],
		}),
	};
}

function nonOkResponse(httpStatus = 500) {
	return { ok: false, status: httpStatus };
}

describe('getGeocodeApiKey', () => {
	it('returns the env var value when set', async () => {
		process.env.OPENCAGE_API_KEY = 'test-key-123';
		const { getGeocodeApiKey } = await import('@/server/lib/geocode');
		expect(getGeocodeApiKey()).toBe('test-key-123');
		delete process.env.OPENCAGE_API_KEY;
	});

	it('returns null when env var is not set', async () => {
		delete process.env.OPENCAGE_API_KEY;
		const { getGeocodeApiKey } = await import('@/server/lib/geocode');
		expect(getGeocodeApiKey()).toBeNull();
	});
});

describe('geocodeLocation — no API key', () => {
	beforeEach(() => {
		delete process.env.OPENCAGE_API_KEY;
		vi.resetModules();
		mockFetch.mockReset();
	});

	it('returns SKIPPED when OPENCAGE_API_KEY is not set', async () => {
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('123 Main St, Springfield, IL 62701');
		expect(result).toEqual({ geocodeStatus: 'SKIPPED' });
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('geocodeLocation — with API key', () => {
	beforeEach(() => {
		process.env.OPENCAGE_API_KEY = 'fake-key';
		vi.resetModules();
		mockFetch.mockReset();
	});

	afterEach(() => {
		delete process.env.OPENCAGE_API_KEY;
	});

	it('returns SUCCESS with lat/lng on a valid response', async () => {
		mockFetch.mockResolvedValueOnce(okResponse(37.3382, -121.8863));
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('200 E Santa Clara St, San Jose, CA');
		expect(result).toEqual({
			geocodeStatus: 'SUCCESS',
			lat: 37.3382,
			lng: -121.8863,
		});
	});

	it('passes the cleaned location string to the OpenCage URL', async () => {
		mockFetch.mockResolvedValueOnce(okResponse(37.3382, -121.8863));
		const { geocodeLocation } = await import('@/server/lib/geocode');
		await geocodeLocation('200 E Santa Clara St, Suite 100, San Jose, CA');
		const calledUrl: string = mockFetch.mock.calls[0][0];
		// "Suite 100" should have been stripped
		expect(calledUrl).not.toContain('Suite%20100');
		// The remaining address should still be present
		expect(calledUrl).toContain('200%20E%20Santa%20Clara%20St');
	});

	it('returns SKIPPED when the cleaned location is empty', async () => {
		const { geocodeLocation } = await import('@/server/lib/geocode');
		// Input that collapses to empty after cleaning (only suite tokens)
		const result = await geocodeLocation('Suite 100,');
		expect(result).toEqual({ geocodeStatus: 'SKIPPED' });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('returns FAILED when HTTP response is not ok', async () => {
		mockFetch.mockResolvedValueOnce(nonOkResponse(503));
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('123 Main St, Anytown, USA');
		expect(result).toEqual({ geocodeStatus: 'FAILED' });
	});

	it('returns FAILED when results array is empty', async () => {
		mockFetch.mockResolvedValueOnce(emptyResultResponse());
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('Somewhere Over the Rainbow');
		expect(result).toEqual({ geocodeStatus: 'FAILED' });
	});

	it('returns FAILED when API status code is not 200', async () => {
		mockFetch.mockResolvedValueOnce(okResponse(0, 0, 402));
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('123 Main St, Springfield, IL');
		expect(result).toEqual({ geocodeStatus: 'FAILED' });
	});

	it('returns FAILED when fetch throws a network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));
		const { geocodeLocation } = await import('@/server/lib/geocode');
		const result = await geocodeLocation('123 Main St, Springfield, IL');
		expect(result).toEqual({ geocodeStatus: 'FAILED' });
	});
});

describe('cleanLocation — suite/floor stripping (via geocodeLocation URL)', () => {
	beforeEach(() => {
		process.env.OPENCAGE_API_KEY = 'fake-key';
		vi.resetModules();
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(okResponse(0, 0));
	});

	afterEach(() => {
		delete process.env.OPENCAGE_API_KEY;
	});

	async function captureEncodedQuery(location: string): Promise<string> {
		const { geocodeLocation } = await import('@/server/lib/geocode');
		await geocodeLocation(location);
		const url: string = mockFetch.mock.calls[0][0];
		const qParam = new URL(url).searchParams.get('q') ?? '';
		return qParam;
	}

	it('strips "suite NNN" token', async () => {
		const q = await captureEncodedQuery(
			'100 Market St, Suite 400, San Francisco, CA',
		);
		expect(q).not.toMatch(/suite/i);
		expect(q).toContain('100 Market St');
	});

	it('strips "ste NNN" abbreviation', async () => {
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(okResponse(0, 0));
		const q = await captureEncodedQuery(
			'100 Market St, Ste 400, San Francisco, CA',
		);
		expect(q).not.toMatch(/\bste\b/i);
	});

	it('strips "floor N" token', async () => {
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(okResponse(0, 0));
		const q = await captureEncodedQuery(
			'1 Infinite Loop, Floor 3, Cupertino, CA',
		);
		expect(q).not.toMatch(/floor/i);
		expect(q).toContain('1 Infinite Loop');
	});

	it('strips "apt N" token', async () => {
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(okResponse(0, 0));
		const q = await captureEncodedQuery('42 Elm Street, Apt 2B, Portland, OR');
		expect(q).not.toMatch(/\bapt\b/i);
	});

	// NOTE: The SUITE_FLOOR_PATTERN uses \b before '#', but '#' is not a word
	// character so \b does not fire before it in typical address strings like
	// ", #200". The '#' case is therefore NOT stripped by cleanLocation — this
	// test documents that known limitation rather than asserting false behaviour.
	it('does NOT strip "#NNN" when "#" follows a non-word boundary (known limitation)', async () => {
		mockFetch.mockReset();
		mockFetch.mockResolvedValue(okResponse(0, 0));
		const q = await captureEncodedQuery('500 Congress Ave, #200, Austin, TX');
		// The street address is still present (cleaning didn't break it)
		expect(q).toContain('500 Congress Ave');
		// '#200' is NOT stripped — document as-is
		expect(q).toContain('#200');
	});
});
