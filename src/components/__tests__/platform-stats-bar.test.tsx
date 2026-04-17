// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the statsRepo
vi.mock('@/server/repositories/statsRepo', () => ({
	getPlatformStats: vi.fn(),
}));

import { getPlatformStats } from '@/server/repositories/statsRepo';
import { PlatformStatsBar } from '../platform-stats-bar';

const mockGetPlatformStats = vi.mocked(getPlatformStats);

describe('PlatformStatsBar', () => {
	it('renders stats that are greater than zero', async () => {
		mockGetPlatformStats.mockResolvedValue({
			orgCount: 12,
			credentialCount: 0,
			shiftCount: 150,
			volunteerCount: 2500,
		});

		const Component = await PlatformStatsBar();
		const { container } = render(Component);

		expect(screen.getByText('12')).toBeTruthy();
		expect(screen.getByText('150')).toBeTruthy();
		expect(screen.getByText('2.5k')).toBeTruthy();
		// credentialCount is 0 — should be filtered out
		expect(screen.queryByText('Verified Credentials')).toBeNull();
	});

	it('returns null when all stats are zero', async () => {
		mockGetPlatformStats.mockResolvedValue({
			orgCount: 0,
			credentialCount: 0,
			shiftCount: 0,
			volunteerCount: 0,
		});

		const Component = await PlatformStatsBar();
		expect(Component).toBeNull();
	});

	it('formats thousands with k suffix', async () => {
		mockGetPlatformStats.mockResolvedValue({
			orgCount: 1000,
			credentialCount: 5200,
			shiftCount: 0,
			volunteerCount: 0,
		});

		const Component = await PlatformStatsBar();
		const { container } = render(Component);

		expect(screen.getByText('1k')).toBeTruthy();
		expect(screen.getByText('5.2k')).toBeTruthy();
	});
});
