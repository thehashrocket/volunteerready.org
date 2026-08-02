// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TRPCClientError } from '@trpc/client';
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_SAFE_ERROR_CODES } from '@/server/domain/error-disclosure';
import {
	QueryErrorCard,
	safeCaughtErrorMessage,
	safeErrorMessage,
} from './query-error-card';

/**
 * The CLIENT half of the disclosure control.
 *
 * As of T37 the server's `errorFormatter` redacts a non-allowlisted message
 * before it is serialized, so this helper is deliberately redundant — it decides
 * what a component PAINTS, not what crosses the wire. These tests pin that half
 * in isolation, which is why they hand it unredacted fixtures the real server
 * would never send: remove the `safeErrorMessage` call and they still go red,
 * even though the formatter would have covered for it.
 *
 * Testing the helper once covers the claim for every consumer, which is cheaper
 * and more durable than a page-level render per surface.
 */
describe('safeErrorMessage', () => {
	it('the allowlist is populated, so the loop below is not vacuous', () => {
		// The loop generates its cases FROM the value under test, so an emptied
		// allowlist would generate zero of them and this block would pass having
		// asserted nothing at all about pass-through.
		expect(CLIENT_SAFE_ERROR_CODES.size).toBe(8);
	});

	// Iterated from the real allowlist rather than a hand-copied array, so
	// adding a code cannot pass here while going untested — the same reason the
	// /privacy disclosure test walks `BackgroundCheckProvider` instead of
	// listing providers.
	for (const code of CLIENT_SAFE_ERROR_CODES) {
		it(`passes a ${code} message through verbatim`, () => {
			expect(
				safeErrorMessage({ message: 'Already on your roster', data: { code } }),
			).toBe('Already on your roster');
		});
	}

	it('SECURITY: withholds an INTERNAL_SERVER_ERROR message', () => {
		// The exact shape that leaked: a Prisma invocation string reaching a
		// staff user because the page rendered `{query.error.message}` raw.
		expect(
			safeErrorMessage({
				message:
					'Invalid `prisma.volunteerApplication.findMany()` invocation: relation does not exist',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			}),
		).toBeUndefined();
	});

	it('SECURITY: withholds a message when the code is missing entirely', () => {
		// Fails CLOSED. A non-tRPC error (network, parse) has no `data.code`, and
		// treating "no code" as safe would defeat the allowlist.
		expect(safeErrorMessage({ message: 'boom' })).toBeUndefined();
		expect(safeErrorMessage({ message: 'boom', data: null })).toBeUndefined();
		expect(safeErrorMessage(null)).toBeUndefined();
	});

	it('SECURITY: withholds an unrecognised code rather than allowing it', () => {
		expect(
			safeErrorMessage({ message: 'internals', data: { code: 'TEAPOT' } }),
		).toBeUndefined();
	});
});

describe('safeCaughtErrorMessage', () => {
	function trpcError(message: string, code: string) {
		// TRPCClientError.from() is how the real client builds these; the shape a
		// `catch` around mutateAsync actually receives.
		return TRPCClientError.from({
			error: { message, code: -32603, data: { code } },
		} as never);
	}

	it('SECURITY: withholds an INTERNAL_SERVER_ERROR message', () => {
		expect(
			safeCaughtErrorMessage(
				trpcError(
					'Invalid `prisma.user.findMany()` invocation',
					'INTERNAL_SERVER_ERROR',
				),
			),
		).toBeUndefined();
	});

	it('SECURITY: withholds a plain Error, which instanceof Error would allow', () => {
		// The whole reason this helper exists. TRPCClientError extends Error, so
		// `err instanceof Error ? err.message : fallback` — the idiom at every
		// mutateAsync catch site before this — passes and returns the raw string.
		expect(safeCaughtErrorMessage(new Error('boom'))).toBeUndefined();
		expect(safeCaughtErrorMessage('boom')).toBeUndefined();
		expect(safeCaughtErrorMessage(null)).toBeUndefined();
	});

	it('passes an allowlisted message through verbatim', () => {
		// Contrast case: without it the assertions above would pass against a
		// helper that returned undefined unconditionally.
		expect(
			safeCaughtErrorMessage(
				trpcError('That volunteer is already on your roster.', 'CONFLICT'),
			),
		).toBe('That volunteer is already on your roster.');
	});
});

describe('QueryErrorCard', () => {
	it('exposes the failure as an alert, not silent text', () => {
		// Every consumer relies on this role rather than adding its own — it is
		// what makes a failed query audible instead of an apparently empty page.
		render(
			<QueryErrorCard
				title="Couldn't load your volunteers"
				message="You do not have access."
				onRetry={vi.fn()}
			/>,
		);

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent("Couldn't load your volunteers");
		expect(alert).toHaveTextContent('You do not have access.');
	});

	it('falls back to generic copy when the message was withheld', () => {
		// The pairing that matters: safeErrorMessage returns undefined for an
		// internal error, and the card must still say something useful rather
		// than render an empty paragraph.
		render(
			<QueryErrorCard
				title="Couldn't load your volunteers"
				message={safeErrorMessage({
					message: 'Invalid `prisma.user.findMany()` invocation',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				})}
				onRetry={vi.fn()}
			/>,
		);

		// Asserted as a LITERAL, deliberately: importing GENERIC_ERROR_MESSAGE
		// here would make the test agree with whatever the constant says,
		// including a change that emptied it.
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
	});

	it('retries on demand and disables itself while retrying', async () => {
		const onRetry = vi.fn();
		const user = userEvent.setup();
		const { rerender } = render(
			<QueryErrorCard title="Nope" onRetry={onRetry} />,
		);

		await user.click(screen.getByRole('button', { name: /try again/i }));
		expect(onRetry).toHaveBeenCalledTimes(1);

		rerender(<QueryErrorCard title="Nope" onRetry={onRetry} isRetrying />);
		expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
	});
});
