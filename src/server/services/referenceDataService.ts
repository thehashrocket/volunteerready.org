/**
 * Reference Data Boot Guard — self-healing runtime check.
 *
 * Ensures the skill catalog and platform org exist before serving requests.
 * Uses a module-level `_seeded` flag to avoid re-checking after first success.
 * Concurrent cold-start calls are deduplicated via a shared promise.
 */

import {
	isCatalogSeeded,
	isPlatformOrgSeeded,
	seedCatalog,
	seedPlatformOrg,
} from '@/server/repositories/referenceDataRepo';

let _seeded = false;
let _seedingPromise: Promise<void> | null = null;

/**
 * Ensure reference data exists. Safe to call on every request — after first
 * success, subsequent calls return immediately (0ms).
 *
 * On Vercel cold starts, re-checks the DB (~1ms). If data is missing, seeds
 * it automatically using idempotent upserts.
 */
export async function ensureReferenceData(): Promise<void> {
	if (_seeded) return;

	// Deduplicate concurrent calls during cold start
	if (_seedingPromise) return _seedingPromise;

	_seedingPromise = _ensureReferenceDataInner();
	try {
		await _seedingPromise;
	} finally {
		_seedingPromise = null;
	}
}

async function _ensureReferenceDataInner(): Promise<void> {
	try {
		const [catalogOk, platformOrgOk] = await Promise.all([
			isCatalogSeeded(),
			isPlatformOrgSeeded(),
		]);

		if (catalogOk && platformOrgOk) {
			_seeded = true;
			return;
		}

		const start = Date.now();

		if (!catalogOk) {
			const result = await seedCatalog();
			console.warn(
				`[referenceDataService] Boot guard seeded skill catalog: ${result.families} families, ${result.skills} skills (${Date.now() - start}ms)`,
			);
		}

		if (!platformOrgOk) {
			await seedPlatformOrg();
			console.warn(
				`[referenceDataService] Boot guard seeded platform org (${Date.now() - start}ms)`,
			);
		}

		_seeded = true;
	} catch (err) {
		// Don't set _seeded — next request will retry
		console.error(
			'[referenceDataService] Boot guard failed — will retry on next request:',
			err,
		);
	}
}

/** Reset for testing only. */
export function _resetForTesting(): void {
	_seeded = false;
	_seedingPromise = null;
}
