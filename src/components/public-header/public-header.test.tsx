// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The signed-in chunk is the thing anonymous visitors must never load, so the
// mock records whether it was imported at all.
const account = vi.hoisted(() => ({ imported: false }));
vi.mock('./account', () => {
	account.imported = true;
	return {
		default: ({ session }: { session: { user: { email: string } } }) => (
			<div data-testid="signed-in-header">{session.user.email}</div>
		),
	};
});

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));

import { fetchSessionPresence, PublicHeader } from '.';

function mockSession(body: unknown, ok = true) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok, json: async () => body })),
	);
}

beforeEach(() => {
	account.imported = false;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('PublicHeader', () => {
	it('shows Sign in to an anonymous visitor without loading the account chunk', async () => {
		mockSession({});
		render(<PublicHeader />);

		await waitFor(() =>
			expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(2),
		);
		expect(
			screen.getAllByRole('link', { name: 'Book a setup call' }),
		).toHaveLength(2);
		expect(account.imported).toBe(false);
	});

	it('loads the signed-in header once a session exists', async () => {
		mockSession({ user: { email: 'pat@example.com' }, expires: '2099-01-01' });
		render(<PublicHeader />);

		expect(await screen.findByTestId('signed-in-header')).toHaveTextContent(
			'pat@example.com',
		);
		expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
	});

	it('shows neither Sign in nor the account while the session is unknown', () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise(() => {})),
		);
		render(<PublicHeader />);

		expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
		expect(screen.queryByTestId('signed-in-header')).toBeNull();
	});
});

describe('fetchSessionPresence', () => {
	it('treats a failed request as signed out', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('offline');
			}),
		);
		await expect(fetchSessionPresence()).resolves.toEqual({
			status: 'unauthenticated',
		});
	});

	it('treats a non-OK response as signed out', async () => {
		mockSession({ user: { email: 'x' } }, false);
		await expect(fetchSessionPresence()).resolves.toEqual({
			status: 'unauthenticated',
		});
	});
});

describe('auth code stays out of the anonymous path', () => {
	// Anything ./index.tsx or ./shell.tsx imports ships to every visitor.
	// Auth code belongs in ./account.tsx, which loads only for a session.
	it.each(['index.tsx', 'shell.tsx'])(
		'%s imports no auth or tRPC client',
		(file) => {
			const source = readFileSync(resolve(__dirname, file), 'utf8');
			// Whole statements, so multi-line imports are read up to their `from`.
			const runtimeImports = [
				...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm),
			]
				.map((m) => m[1])
				.join('\n');
			// Sanity check that the pattern sees imports at all.
			expect(runtimeImports).toContain('react');
			expect(runtimeImports).not.toMatch(
				/next-auth|@\/lib\/trpc|@tanstack\/react-query|notification-bell|ui\/dropdown-menu/,
			);
		},
	);
});
