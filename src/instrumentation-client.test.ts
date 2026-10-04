// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// The browser config is a side-effect module: it calls Sentry.init on import.
// Each test sets the page URL, then imports it fresh against a mocked SDK and
// checks what it passed in, so dropping any scrubber fails here.

const sentry = vi.hoisted(() => ({
	init: vi.fn(),
	replayIntegration: vi.fn((options: unknown) => ({ name: 'Replay', options })),
	addEventProcessor: vi.fn(),
	getReplay: vi.fn(),
	captureRouterTransitionStart: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => sentry);

type InitOptions = {
	integrations: Array<{
		name: string;
		options: { beforeAddRecordingEvent: (e: unknown) => unknown };
	}>;
	beforeSend: (event: unknown) => unknown;
	beforeBreadcrumb: (breadcrumb: unknown) => unknown;
	beforeSendSpan: (span: unknown) => unknown;
};

async function loadAt(path: string) {
	window.history.replaceState({}, '', path);
	vi.resetModules();
	sentry.init.mockClear();
	sentry.replayIntegration.mockClear();
	sentry.addEventProcessor.mockClear();
	const mod = await import('./instrumentation-client');
	return {
		mod,
		options: sentry.init.mock.calls[0][0] as InitOptions,
	};
}

afterEach(() => {
	window.history.replaceState({}, '', '/');
});

describe('browser Sentry config', () => {
	it('records replay on an ordinary page, scrubbing its custom events', async () => {
		const { options } = await loadAt('/app/volunteers');

		expect(options.integrations).toHaveLength(1);
		const scrub = options.integrations[0].options.beforeAddRecordingEvent;
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
		const { options } = await loadAt(path);

		expect(options.integrations).toEqual([]);
		expect(sentry.replayIntegration).not.toHaveBeenCalled();
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
