// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImpersonationBanner } from '../impersonation-banner';

function mockLocation() {
	const reload = vi.fn();
	const hrefSetter = vi.fn();
	const locationMock = {
		reload,
		get href() {
			return 'http://localhost/';
		},
		set href(value: string) {
			hrefSetter(value);
		},
	};
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: locationMock,
	});
	return { reload, hrefSetter };
}

describe('ImpersonationBanner', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-17T14:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('renders target label and initial remaining time', () => {
		mockLocation();
		const expiresAt = new Date('2026-04-17T14:30:00Z').toISOString(); // +30 min

		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName="Val Volunteer"
				expiresAt={expiresAt}
			/>,
		);

		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(
			screen.getByText(/Val Volunteer \(v@example.com\)/),
		).toBeInTheDocument();
		expect(screen.getByText(/30m 00s/)).toBeInTheDocument();
	});

	it('falls back to email when targetName is missing', () => {
		mockLocation();
		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={new Date('2026-04-17T14:10:00Z').toISOString()}
			/>,
		);

		expect(screen.getByText(/v@example.com/)).toBeInTheDocument();
	});

	it('counts down every second', () => {
		mockLocation();
		const expiresAt = new Date('2026-04-17T14:01:00Z').toISOString(); // +1 min

		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={expiresAt}
			/>,
		);

		expect(screen.getByText(/1m 00s/)).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(screen.getByText(/0m 59s/)).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(screen.getByText(/0m 29s/)).toBeInTheDocument();
	});

	it('navigates to the users list when the session expires', () => {
		const { hrefSetter } = mockLocation();
		const expiresAt = new Date('2026-04-17T14:00:05Z').toISOString(); // +5s

		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={expiresAt}
			/>,
		);

		expect(hrefSetter).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(6_000);
		});

		expect(hrefSetter).toHaveBeenCalledWith('/app/admin/platform/users');
		expect(hrefSetter).toHaveBeenCalledTimes(1);
	});

	it('calls end endpoint and navigates on End button click', async () => {
		const { hrefSetter } = mockLocation();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);

		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={new Date('2026-04-17T14:30:00Z').toISOString()}
			/>,
		);

		const button = screen.getByRole('button', { name: /end session/i });

		await act(async () => {
			button.click();
			await vi.runAllTimersAsync();
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/platform-admin/impersonation/end',
			{ method: 'POST' },
		);
		expect(hrefSetter).toHaveBeenCalledWith('/app/admin/platform/users');
	});

	it('shows inline error and does not navigate when end-session fetch fails', async () => {
		const { hrefSetter } = mockLocation();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			text: vi.fn().mockResolvedValue('Session already ended.'),
		});
		vi.stubGlobal('fetch', fetchMock);

		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={new Date('2026-04-17T14:30:00Z').toISOString()}
			/>,
		);

		const button = screen.getByRole('button', { name: /end session/i });

		await act(async () => {
			button.click();
			// Advance only enough to settle the fetch promise microtasks without
			// expiring the 30-minute session, which would trigger navigation.
			await vi.advanceTimersByTimeAsync(100);
		});

		expect(hrefSetter).not.toHaveBeenCalled();
		expect(screen.getByText(/Session already ended/)).toBeInTheDocument();
		// Button should be re-enabled so admin can retry
		expect(button).not.toBeDisabled();
	});

	it('shows "expired" label when remaining drops to zero before tick', () => {
		mockLocation();
		// Already-expired timestamp
		render(
			<ImpersonationBanner
				targetEmail="v@example.com"
				targetName={null}
				expiresAt={new Date('2026-04-17T13:00:00Z').toISOString()}
			/>,
		);

		expect(screen.getByText(/expired/)).toBeInTheDocument();
	});
});
