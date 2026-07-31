// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryErrorCard, safeErrorMessage } from './query-error-card';

/**
 * `safeErrorMessage` is the only thing standing between a tRPC error and a
 * coordinator's screen on NINE surfaces, and until this file it had no test of
 * its own — T35's verify step ("force a query failure on each of the four
 * pages, assert no internal error string is rendered") was satisfied by
 * inspection alone. Testing the helper once covers the claim for every consumer,
 * which is cheaper and more durable than four page-level renders.
 */
describe('safeErrorMessage', () => {
	// The allowlist exists because these codes are authored by our own
	// procedures; everything else may carry a Prisma or driver string.
	const CLIENT_SAFE = [
		'BAD_REQUEST',
		'UNAUTHORIZED',
		'FORBIDDEN',
		'NOT_FOUND',
		'CONFLICT',
		'PRECONDITION_FAILED',
		'TOO_MANY_REQUESTS',
	];

	for (const code of CLIENT_SAFE) {
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
