// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// The browser config is a side-effect module: it calls Sentry.init on import.
// Each test sets the page URL, then imports it fresh against a mocked SDK and
// checks what it passed in, so dropping any scrubber fails here.

const sentry = vi.hoisted(() => ({
	init: vi.fn(),
	lazyLoadIntegration: vi.fn(),
	addIntegration: vi.fn(),
	addEventProcessor: vi.fn(),
	getReplay: vi.fn(),
	captureRouterTransitionStart: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => sentry);

const replayIntegration = vi.fn((options: unknown) => ({
	name: 'Replay',
	options,
}));

type ReplayIntegration = {
	name: string;
	options: { beforeAddRecordingEvent: (e: unknown) => unknown };
};

type InitOptions = {
	integrations: unknown[];
	beforeSend: (event: unknown) => unknown;
	beforeBreadcrumb: (breadcrumb: unknown) => unknown;
	beforeSendSpan: (span: unknown) => unknown;
};

async function loadAt(path: string) {
	window.history.replaceState({}, '', path);
	vi.resetModules();
	// The module schedules the replay download on import; fake timers keep
	// that from firing in the middle of an unrelated test.
	vi.useFakeTimers();
	sentry.init.mockClear();
	sentry.lazyLoadIntegration.mockReset();
	sentry.lazyLoadIntegration.mockResolvedValue(replayIntegration);
	sentry.addIntegration.mockClear();
	sentry.addEventProcessor.mockClear();
	replayIntegration.mockClear();
	const mod = await import('./instrumentation-client');
	return {
		mod,
		options: sentry.init.mock.calls[0][0] as InitOptions,
	};
}

afterEach(() => {
	vi.useRealTimers();
	window.history.replaceState({}, '', '/');
});

describe('browser Sentry config', () => {
	it('does not bundle replay: init starts with no integrations', async () => {
		const { options } = await loadAt('/app/volunteers');

		expect(options.integrations).toEqual([]);
	});

	it('loads replay from the CDN once the page is idle', async () => {
		await loadAt('/app/volunteers');
		expect(sentry.lazyLoadIntegration).not.toHaveBeenCalled();

		await vi.runAllTimersAsync();

		expect(sentry.lazyLoadIntegration).toHaveBeenCalledWith(
			'replayIntegration',
		);
		expect(sentry.addIntegration).toHaveBeenCalledTimes(1);
	});

	it('records replay on an ordinary page, scrubbing its custom events', async () => {
		const { mod } = await loadAt('/app/volunteers');
		await mod.loadReplay();

		const added = sentry.addIntegration.mock.calls[0][0] as ReplayIntegration;
		const scrub = added.options.beforeAddRecordingEvent;
		expect(
			scrub({
				type: 5,
				data: { tag: 'navigation', payload: { to: '/invite/abc123' } },
			}),
		).toEqual({
			type: 5,
			data: { tag: 'navigation', payload: { to: '/invite/[Filtered]' } },
		});
	});

	it.each([
		'/invite/abc123',
		'/credentials/claim/abc123',
		'/apply/status?token=t',
	])('does not record replay when the page URL is %s', async (path) => {
		const { mod, options } = await loadAt(path);
		await mod.loadReplay();
		await vi.runAllTimersAsync();

		expect(options.integrations).toEqual([]);
		expect(sentry.lazyLoadIntegration).not.toHaveBeenCalled();
		expect(sentry.addIntegration).not.toHaveBeenCalled();
	});

	it('never starts replay if the visitor reached a secret URL while it downloaded', async () => {
		const { mod } = await loadAt('/app');
		let finish: (fn: typeof replayIntegration) => void = () => {};
		sentry.lazyLoadIntegration.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		sentry.getReplay.mockReturnValue(undefined);

		const loading = mod.loadReplay();
		mod.onRouterTransitionStart('/invite/abc123', 'push');
		finish(replayIntegration);
		await loading;

		expect(sentry.addIntegration).not.toHaveBeenCalled();
	});

	it('keeps working when the replay script is blocked', async () => {
		const { mod } = await loadAt('/app');
		sentry.lazyLoadIntegration.mockRejectedValue(new Error('blocked'));

		await expect(mod.loadReplay()).resolves.toBeUndefined();
		expect(sentry.addIntegration).not.toHaveBeenCalled();
	});

	it('scrubs error events, breadcrumbs and spans', async () => {
		const { options } = await loadAt('/app');

		expect(
			options.beforeSend({ request: { url: 'https://x.test/invite/abc' } }),
		).toEqual({ request: { url: 'https://x.test/invite/[Filtered]' } });
		expect(
			options.beforeBreadcrumb({
				category: 'navigation',
				data: { to: '/invite/company/abc' },
			}),
		).toEqual({
			category: 'navigation',
			data: { to: '/invite/company/[Filtered]' },
		});
		expect(
			options.beforeSendSpan({
				name: '/credentials/claim/abc',
				attributes: {},
			}),
		).toEqual({ name: '/credentials/claim/[Filtered]', attributes: {} });
	});

	it('keeps streamed spans, the mode beforeSendSpan was written for', async () => {
		const { options } = await loadAt('/app');

		// In 'static' mode spans travel inside transaction events, which never
		// reach beforeSendSpan, and nothing here scrubs them.
		expect(
			(options as { traceLifecycle?: string }).traceLifecycle ?? 'stream',
		).toBe('stream');
	});

	it('scrubs replay events too, which skip beforeSend', async () => {
		await loadAt('/app');

		expect(sentry.addEventProcessor).toHaveBeenCalledTimes(1);
		const processor = sentry.addEventProcessor.mock.calls[0][0] as (
			e: unknown,
		) => unknown;
		expect(
			processor({ type: 'replay_event', urls: ['https://x.test/invite/abc'] }),
		).toEqual({
			type: 'replay_event',
			urls: ['https://x.test/invite/[Filtered]'],
		});
	});

	it('stops replay before an in-app navigation to a secret URL', async () => {
		const { mod } = await loadAt('/app');
		const stop = vi.fn(async () => {});
		sentry.getReplay.mockReturnValue({ stop });

		mod.onRouterTransitionStart('/app/volunteers', 'push');
		expect(stop).not.toHaveBeenCalled();

		mod.onRouterTransitionStart('/invite/abc123', 'push');
		expect(stop).toHaveBeenCalledTimes(1);
		expect(sentry.captureRouterTransitionStart).toHaveBeenCalledWith(
			'/invite/abc123',
			'push',
		);
	});

	it('still navigates when replay never started', async () => {
		// The common case: a page loaded at a token URL never starts replay.
		const { mod } = await loadAt('/invite/abc123');
		sentry.getReplay.mockReturnValue(undefined);

		expect(() =>
			mod.onRouterTransitionStart('/credentials/claim/x', 'push'),
		).not.toThrow();
		expect(sentry.captureRouterTransitionStart).toHaveBeenCalledWith(
			'/credentials/claim/x',
			'push',
		);
	});
});
