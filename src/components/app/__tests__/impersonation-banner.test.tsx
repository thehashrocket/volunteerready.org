// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
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
		// A response body the route did not author — a framework error page is the
		// realistic shape here, and it used to be rendered verbatim to the admin.
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			text: vi
				.fn()
				.mockResolvedValue(
					'<html><body>Error: connect ECONNREFUSED 10.0.0.4:5432</body></html>',
				),
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
		// SECURITY: fixed copy, never the body. `res.text()` returns whatever the
		// route, the framework or an edge proxy produced, and this surface is one
		// the guard test cannot see (it skips `src/app` + `/api`).
		expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
		expect(
			screen.getByText('Failed to end session. Try again.'),
		).toBeInTheDocument();
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

	// -------------------------------------------------------------------------
	// Hydration safety.
	//
	// This banner is `'use client'` but is server-rendered from
	// `app/(app)/app/layout.tsx`, so its FIRST render happens twice: once on the
	// server, once at hydration. If that render reads the clock, the two passes
	// disagree the moment a second ticks over between them, React reports
	// "server rendered text didn't match" and RECOVERS BY DISCARDING THE TREE —
	// leaving every control in the app shell dead to clicks until it re-renders.
	//
	// Caught in CI, not locally: on a warm machine SSR and hydration land in the
	// same second and the strings match by luck. `e2e/impersonation-company-
	// picker.spec.ts` failed on a cold runner because a click on the sidebar
	// went nowhere.
	//
	// These assert the PROPERTY (first render is clock-independent) rather than
	// the symptom, because no jsdom test can observe a real hydration mismatch.
	// -------------------------------------------------------------------------
	describe('hydration safety', () => {
		function ssr(expiresAt: string) {
			// `renderToStaticMarkup`, not `render`: it is the server pass, with no
			// effects. `render()` flushes effects, which is exactly the thing that
			// is allowed to read the clock — so a jsdom render would hide the bug.
			return renderToStaticMarkup(
				<ImpersonationBanner
					targetEmail="v@example.com"
					targetName="Val Volunteer"
					expiresAt={expiresAt}
				/>,
			);
		}

		it('renders identical markup no matter when the server renders it', () => {
			const expiresAt = new Date('2026-04-17T14:30:00Z').toISOString();

			vi.setSystemTime(new Date('2026-04-17T14:00:00Z'));
			const atServerRender = ssr(expiresAt);

			// The gap a slow response opens between SSR and hydration. Seven
			// seconds is arbitrary; ONE is enough to change `formatRemaining`.
			vi.setSystemTime(new Date('2026-04-17T14:00:07Z'));
			const atHydration = ssr(expiresAt);

			expect(atHydration).toBe(atServerRender);
		});

		it('renders no countdown digits at all on the server', () => {
			// Stronger than the equality above, which a component that froze the
			// clock could also satisfy. The countdown is CLIENT-only state; if any
			// `\d+m \d+s` reaches the server pass, something read the clock.
			const markup = ssr(new Date('2026-04-17T14:30:00Z').toISOString());

			expect(markup).not.toMatch(/\d+m \d{2}s/);
			expect(markup).toContain('expires in');
		});
	});
});
