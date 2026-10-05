import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

// Mock the repo module
vi.mock('@/server/repositories/referenceDataRepo', () => ({
	areTemplateQuestionsSeeded: vi.fn(),
	isCatalogSeeded: vi.fn(),
	isPlatformOrgSeeded: vi.fn(),
	seedCatalog: vi.fn(),
	seedPlatformOrg: vi.fn(),
	seedPlatformTemplateQuestions: vi.fn(),
}));

import {
	areTemplateQuestionsSeeded,
	isCatalogSeeded,
	isPlatformOrgSeeded,
	seedCatalog,
	seedPlatformOrg,
	seedPlatformTemplateQuestions,
} from '@/server/repositories/referenceDataRepo';
import {
	_resetForTesting,
	ensureReferenceData,
} from '@/server/services/referenceDataService';

const mockAreTemplateQuestionsSeeded = vi.mocked(areTemplateQuestionsSeeded);
const mockIsCatalogSeeded = vi.mocked(isCatalogSeeded);
const mockIsPlatformOrgSeeded = vi.mocked(isPlatformOrgSeeded);
const mockSeedCatalog = vi.mocked(seedCatalog);
const mockSeedPlatformOrg = vi.mocked(seedPlatformOrg);
const mockSeedPlatformTemplateQuestions = vi.mocked(
	seedPlatformTemplateQuestions,
);

beforeEach(() => {
	vi.clearAllMocks();
	_resetForTesting();
});

// Console spies in these tests are restored, so later tests keep their output.
afterEach(() => {
	vi.restoreAllMocks();
});

describe('ensureReferenceData', () => {
	it('skips when _seeded is true', async () => {
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);

		await ensureReferenceData();
		await ensureReferenceData();

		// First call checks, second call skips entirely
		expect(mockIsCatalogSeeded).toHaveBeenCalledTimes(1);
	});

	it('seeds skill catalog when count returns 0', async () => {
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);
		mockSeedCatalog.mockResolvedValue({ families: 13, skills: 62 });

		await ensureReferenceData();

		expect(mockSeedCatalog).toHaveBeenCalledTimes(1);
		expect(mockSeedPlatformOrg).not.toHaveBeenCalled();
		expect(mockSeedPlatformTemplateQuestions).not.toHaveBeenCalled();
	});

	it('seeds platform org when not found', async () => {
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(false);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);
		mockSeedPlatformOrg.mockResolvedValue();

		await ensureReferenceData();

		expect(mockSeedPlatformOrg).toHaveBeenCalledTimes(1);
		expect(mockSeedCatalog).not.toHaveBeenCalled();
		expect(mockSeedPlatformTemplateQuestions).not.toHaveBeenCalled();
	});

	it('seeds template questions when not seeded', async () => {
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(false);
		mockSeedPlatformTemplateQuestions.mockResolvedValue({
			created: 6,
			repaired: 0,
		});

		await ensureReferenceData();

		expect(mockSeedPlatformTemplateQuestions).toHaveBeenCalledTimes(1);
		expect(mockSeedCatalog).not.toHaveBeenCalled();
		expect(mockSeedPlatformOrg).not.toHaveBeenCalled();
	});

	it('sets _seeded flag after successful check', async () => {
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);

		await ensureReferenceData();
		await ensureReferenceData();

		expect(mockIsCatalogSeeded).toHaveBeenCalledTimes(1);
		expect(mockIsPlatformOrgSeeded).toHaveBeenCalledTimes(1);
		expect(mockAreTemplateQuestionsSeeded).toHaveBeenCalledTimes(1);
	});

	it('logs when seeding triggers', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(false);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(false);
		mockSeedCatalog.mockResolvedValue({ families: 13, skills: 62 });
		mockSeedPlatformOrg.mockResolvedValue();
		mockSeedPlatformTemplateQuestions.mockResolvedValue({
			created: 6,
			repaired: 0,
		});

		await ensureReferenceData();

		expect(warnSpy).toHaveBeenCalledTimes(3);
		expect(warnSpy.mock.calls[0]?.[0]).toContain(
			'Boot guard seeded skill catalog',
		);
		expect(warnSpy.mock.calls[1]?.[0]).toContain(
			'Boot guard seeded platform org',
		);
		expect(warnSpy.mock.calls[2]?.[0]).toContain('Boot guard seeded');

		warnSpy.mockRestore();
	});

	it('deduplicates concurrent calls via shared promise', async () => {
		let resolveCheck: () => void = () => {};
		const checkPromise = new Promise<boolean>((r) => {
			resolveCheck = () => r(true);
		});
		mockIsCatalogSeeded.mockReturnValue(checkPromise as Promise<boolean>);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);

		const p1 = ensureReferenceData();
		const p2 = ensureReferenceData();
		const p3 = ensureReferenceData();

		resolveCheck?.();
		await Promise.all([p1, p2, p3]);

		// Only one check despite three calls
		expect(mockIsCatalogSeeded).toHaveBeenCalledTimes(1);
	});

	it('does not set _seeded on error, logs error, does not throw', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockIsCatalogSeeded.mockRejectedValue(new Error('DB down'));

		// Should not throw
		await ensureReferenceData();

		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy.mock.calls[0]?.[0]).toContain('Boot guard failed');
		expect(sentry.captureException).toHaveBeenCalledWith(
			new Error('DB down'),
			expect.objectContaining({ tags: { boot_guard_step: 'checks' } }),
		);

		// Next call should retry since _seeded was not set
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);
		await ensureReferenceData();
		expect(mockIsCatalogSeeded).toHaveBeenCalledTimes(2);

		errorSpy.mockRestore();
	});

	it('re-seeds when version mismatch detected (isCatalogSeeded returns false)', async () => {
		// Simulates CATALOG_VERSION > stored version: isCatalogSeeded returns false
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);
		mockSeedCatalog.mockResolvedValue({ families: 13, skills: 62 });

		vi.spyOn(console, 'warn').mockImplementation(() => {});

		await ensureReferenceData();

		expect(mockSeedCatalog).toHaveBeenCalledTimes(1);

		// After re-seed, _seeded is true — next call skips
		await ensureReferenceData();
		expect(mockSeedCatalog).toHaveBeenCalledTimes(1);

		vi.restoreAllMocks();
	});

	it('seeds both catalog and platform org when both missing', async () => {
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(false);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(true);
		mockSeedCatalog.mockResolvedValue({ families: 13, skills: 62 });
		mockSeedPlatformOrg.mockResolvedValue();

		vi.spyOn(console, 'warn').mockImplementation(() => {});

		await ensureReferenceData();

		expect(mockSeedCatalog).toHaveBeenCalledTimes(1);
		expect(mockSeedPlatformOrg).toHaveBeenCalledTimes(1);

		vi.restoreAllMocks();
	});

	// Value: protects=a failed skill-catalog seed still lets the template
	// repair run, so signups get their questions; fails_when=the guard's steps
	// share one try again; why_new=no test failed one step and checked the
	// others; seam=none
	it('repairs the templates even when the catalog seed fails, and retries', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(false);
		mockSeedCatalog.mockRejectedValueOnce(new Error('catalog version clash'));
		mockSeedPlatformTemplateQuestions.mockResolvedValue({
			created: 0,
			repaired: 5,
		});

		await ensureReferenceData();

		expect(mockSeedPlatformTemplateQuestions).toHaveBeenCalledTimes(1);
		expect(sentry.captureException).toHaveBeenCalledTimes(1);
		// Not marked done: the next request retries the failed step.
		await ensureReferenceData();
		expect(mockIsCatalogSeeded).toHaveBeenCalledTimes(2);
		consoleErr.mockRestore();
	});

	// Value: protects=when several steps fail, Sentry gets the template
	// failure that leaves signups without questions; fails_when=only the first
	// failing step is reported; why_new=one report per interval hid it behind
	// a failing catalog step; seam=none
	it('reports the template failure when the catalog seed also fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockIsCatalogSeeded.mockResolvedValue(false);
		mockIsPlatformOrgSeeded.mockResolvedValue(true);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(false);
		mockSeedCatalog.mockRejectedValueOnce(new Error('catalog'));
		mockSeedPlatformTemplateQuestions.mockRejectedValueOnce(
			new Error('templates'),
		);

		await ensureReferenceData();

		expect(sentry.captureException).toHaveBeenCalledTimes(1);
		expect(sentry.captureException).toHaveBeenCalledWith(
			new Error('templates'),
			{
				tags: { boot_guard_step: 'template questions' },
				extra: { failed_steps: ['skill catalog', 'template questions'] },
			},
		);
	});

	// Value: protects=Sentry reports why the platform org could not be seeded,
	// not the template step's derived error; fails_when=the template step runs
	// after a failed platform-org step; why_new=new step ordering; seam=none
	it('skips the template step when the platform org could not be seeded', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mockIsCatalogSeeded.mockResolvedValue(true);
		mockIsPlatformOrgSeeded.mockResolvedValue(false);
		mockAreTemplateQuestionsSeeded.mockResolvedValue(false);
		mockSeedPlatformOrg.mockRejectedValueOnce(new Error('platform insert'));

		await ensureReferenceData();

		expect(mockSeedPlatformTemplateQuestions).not.toHaveBeenCalled();
		expect(sentry.captureException).toHaveBeenCalledWith(
			new Error('platform insert'),
			expect.objectContaining({ tags: { boot_guard_step: 'platform org' } }),
		);
	});

	it('reports a persistent failure to Sentry once per interval, not on every retry', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockIsCatalogSeeded.mockRejectedValue(new Error('DB down'));

		await ensureReferenceData();
		await ensureReferenceData();
		await ensureReferenceData();

		expect(errorSpy).toHaveBeenCalledTimes(3);
		expect(sentry.captureException).toHaveBeenCalledTimes(1);
		errorSpy.mockRestore();
	});

	it('reports the failure again once the interval has passed', async () => {
		vi.useFakeTimers();
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockIsCatalogSeeded.mockRejectedValue(new Error('DB down'));
		try {
			await ensureReferenceData();
			vi.advanceTimersByTime(10 * 60_000 - 1);
			await ensureReferenceData();
			expect(sentry.captureException).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(1);
			await ensureReferenceData();
			expect(sentry.captureException).toHaveBeenCalledTimes(2);
		} finally {
			errorSpy.mockRestore();
			vi.useRealTimers();
		}
	});
});
