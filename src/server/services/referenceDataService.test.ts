import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		mockSeedPlatformTemplateQuestions.mockResolvedValue({ created: 6 });

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
		mockSeedPlatformTemplateQuestions.mockResolvedValue({ created: 6 });

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
		let resolveCheck: () => void;
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
});
