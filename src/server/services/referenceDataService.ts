/**
 * Reference Data Boot Guard — self-healing runtime check.
 *
 * Ensures the skill catalog, platform org, and template screener questions
 * exist before serving requests. Uses a module-level `_seeded` flag to avoid
 * re-checking after first success. Concurrent cold-start calls are
 * deduplicated via a shared promise.
 *
 * Seeding never overwrites content: question and catalog edits made in the
 * platform admin catalog editor survive boot-time seeding. The one write to
 * existing rows is marking the platform org's default questions as templates.
 */

import * as Sentry from '@sentry/nextjs';
import {
	areTemplateQuestionsSeeded,
	isCatalogSeeded,
	isPlatformOrgSeeded,
	seedCatalog,
	seedPlatformOrg,
	seedPlatformTemplateQuestions,
} from '@/server/repositories/referenceDataRepo';

let _seeded = false;
let _seedingPromise: Promise<void> | null = null;

// A failing guard retries on every call, including public requests, so its
// Sentry report is throttled: at most one per instance every 10 minutes (each
// new serverless instance still reports its first failure).
const FAILURE_REPORT_INTERVAL_MS = 10 * 60_000;
let _lastFailureReportAt: number | null = null;

/**
 * Ensure reference data exists. Safe to call on every request — after first
 * success, subsequent calls return immediately (0ms).
 *
 * On Vercel cold starts, re-checks the DB (~1ms). If data is missing, seeds
 * it automatically without overwriting DB edits.
 */
export async function ensureReferenceData(): Promise<void> {
	if (_seeded) return;

	if (_seedingPromise) return _seedingPromise;

	_seedingPromise = _ensureReferenceDataInner();
	try {
		await _seedingPromise;
	} finally {
		_seedingPromise = null;
	}
}

async function _ensureReferenceDataInner(): Promise<void> {
	const failures: { step: string; err: unknown }[] = [];
	const fail = (step: string, err: unknown) => {
		console.error(
			`[referenceDataService] Boot guard failed (${step}) — will retry on next request:`,
			err,
		);
		failures.push({ step, err });
	};

	try {
		const [catalogOk, platformOrgOk, templatesOk] = await Promise.all([
			isCatalogSeeded(),
			isPlatformOrgSeeded(),
			areTemplateQuestionsSeeded(),
		]);

		if (catalogOk && platformOrgOk && templatesOk) {
			_seeded = true;
			return;
		}

		const start = Date.now();
		// Each step runs on its own: a failed skill-catalog seed must not stop
		// the template repair that every signup depends on.
		if (!catalogOk) {
			try {
				const result = await seedCatalog();
				console.warn(
					`[referenceDataService] Boot guard seeded skill catalog: ${result.families} families, ${result.skills} skills (${Date.now() - start}ms)`,
				);
			} catch (err) {
				fail('skill catalog', err);
			}
		}

		if (!platformOrgOk) {
			try {
				await seedPlatformOrg();
				console.warn(
					`[referenceDataService] Boot guard seeded platform org (${Date.now() - start}ms)`,
				);
			} catch (err) {
				fail('platform org', err);
			}
		}

		// The templates live on the platform org: without it this step can only
		// fail with a derived error that would hide the real one.
		const platformOrgFailed = failures.some((f) => f.step === 'platform org');
		if (!templatesOk && !platformOrgFailed) {
			try {
				const result = await seedPlatformTemplateQuestions();
				console.warn(
					`[referenceDataService] Boot guard seeded ${result.created} template screener questions and marked ${result.repaired} existing platform questions as templates (${Date.now() - start}ms)`,
				);
			} catch (err) {
				fail('template questions', err);
			}
		}
	} catch (err) {
		fail('checks', err);
	}

	if (failures.length === 0) {
		_seeded = true;
		return;
	}

	// A failing guard retries forever without surfacing; this one ran unseen
	// on every cold start for months.
	const now = Date.now();
	if (
		_lastFailureReportAt === null ||
		now - _lastFailureReportAt >= FAILURE_REPORT_INTERVAL_MS
	) {
		_lastFailureReportAt = now;
		// One report per interval: the template step if it failed (every signup
		// depends on it), otherwise the first failure. Each names its step.
		const reported =
			failures.find((f) => f.step === 'template questions') ?? failures[0];
		Sentry.captureException(reported.err, {
			tags: { boot_guard_step: reported.step },
			extra: { failed_steps: failures.map((f) => f.step) },
		});
	}
}

/** Reset for testing only. */
export function _resetForTesting(): void {
	_seeded = false;
	_seedingPromise = null;
	_lastFailureReportAt = null;
}
