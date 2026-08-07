// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdatePrompt } from '@/components/app/app-update-prompt';
import type { AppUpdateState } from '@/lib/hooks/use-app-update-check';
import { RELOADED_FOR_KEY } from '@/lib/hooks/use-app-update-check';

const PENDING: AppUpdateState = {
	isUpdateAvailable: true,
	deployedBuildId: 'build-b',
	deployedVersion: '0.42.0.0',
	severity: 'notice',
};

function renderPrompt(overrides: Partial<AppUpdateState> = {}, props = {}) {
	return render(
		<AppUpdatePrompt
			update={{ ...PENDING, ...overrides }}
			isModalOpen={false}
			isAllowedHere
			{...props}
		/>,
	);
}

const strip = () => screen.queryByTestId('app-update-prompt');

beforeEach(() => {
	window.localStorage.clear();
	window.sessionStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('when the strip renders', () => {
	it('renders on a pending notice release', () => {
		renderPrompt();
		expect(strip()).toBeInTheDocument();
	});

	it('renders nothing when no update is pending', () => {
		renderPrompt({ isUpdateAvailable: false });
		expect(strip()).not.toBeInTheDocument();
	});

	it('renders nothing for a SILENT release', () => {
		// The default. Most releases are dependency bumps and CI changes; a
		// strip on each one trains a dismiss-without-reading reflex, and then
		// the feature is worse than useless on the day it matters.
		renderPrompt({ severity: 'silent' });
		expect(strip()).not.toBeInTheDocument();
	});

	it('renders nothing where the surface forbids it', () => {
		// /app/scan is the QR check-in scanner, used by volunteers mid-event.
		renderPrompt({}, { isAllowedHere: false });
		expect(strip()).not.toBeInTheDocument();
	});
});

describe('the modal latch', () => {
	it('does not appear while a modal is already open', () => {
		renderPrompt({}, { isModalOpen: true });
		expect(strip()).not.toBeInTheDocument();
	});

	it('appears once the modal closes', () => {
		const { rerender } = render(
			<AppUpdatePrompt update={PENDING} isModalOpen isAllowedHere />,
		);
		expect(strip()).not.toBeInTheDocument();

		rerender(
			<AppUpdatePrompt update={PENDING} isModalOpen={false} isAllowedHere />,
		);
		expect(strip()).toBeInTheDocument();
	});

	it('STAYS visible when a modal opens afterwards', () => {
		// THE latch (decision 44). Unmounting an already-visible strip makes
		// every row behind the translucent overlay jump up 48px and back down
		// on close — worse than the interruption the suppression prevents, and
		// on the exact surface it was written for.
		const { rerender } = render(
			<AppUpdatePrompt update={PENDING} isModalOpen={false} isAllowedHere />,
		);
		expect(strip()).toBeInTheDocument();

		rerender(<AppUpdatePrompt update={PENDING} isModalOpen isAllowedHere />);
		expect(strip()).toBeInTheDocument();
	});
});

describe('dismissal', () => {
	it('hides the strip and is scoped to this version', async () => {
		const user = userEvent.setup();
		renderPrompt();
		await user.click(screen.getByRole('button', { name: 'Not now' }));

		expect(strip()).not.toBeInTheDocument();
		expect(window.localStorage.getItem('vr_app_update_dismissed')).toBe(
			'0.42.0.0',
		);
	});

	it('re-arms on the next release', () => {
		window.localStorage.setItem('vr_app_update_dismissed', '0.42.0.0');
		renderPrompt({ deployedVersion: '0.43.0.0' });
		// "Not now" means "stop interrupting me about THIS release", not
		// "never mention updates again".
		expect(strip()).toBeInTheDocument();
	});

	it('stays hidden for the version it was dismissed for', () => {
		window.localStorage.setItem('vr_app_update_dismissed', '0.42.0.0');
		renderPrompt();
		expect(strip()).not.toBeInTheDocument();
	});
});

describe('reload', () => {
	it('records the build before reloading, and disables itself', async () => {
		const reload = vi.fn();
		Object.defineProperty(window, 'location', {
			value: { ...window.location, reload },
			writable: true,
		});

		const user = userEvent.setup();
		renderPrompt();
		await user.click(screen.getByRole('button', { name: 'Reload' }));

		// Written BEFORE reloading, so a reload that lands on a stale cached
		// shell cannot re-prompt for the same build forever.
		expect(window.sessionStorage.getItem(RELOADED_FOR_KEY)).toBe('build-b');
		expect(reload).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Reloading…' })).toBeDisabled();
	});
});

describe('the live region', () => {
	it('is present and EMPTY before any update', () => {
		// A live region inserted in the same commit as its first text is
		// unreliably announced, so the FIRST update — the one that proves the
		// feature works — is the one most likely to be silent. The repo's own
		// rule, from AddVolunteerDialog's count region.
		const { container } = renderPrompt({ isUpdateAvailable: false });
		const region = container.querySelector('output[aria-live="polite"]');
		expect(region).toBeInTheDocument();
		expect(region).toBeEmptyDOMElement();
	});

	it('is populated once the strip appears', () => {
		const { container } = renderPrompt();
		const region = container.querySelector('output[aria-live="polite"]');
		expect(region).not.toBeEmptyDOMElement();
	});

	it('is not hidden with display:none', () => {
		// `hidden` or `empty:hidden` would take it back out of the
		// accessibility tree, reintroducing the bug the empty mount avoids.
		const { container } = renderPrompt({ isUpdateAvailable: false });
		const region = container.querySelector('output[aria-live="polite"]');
		expect(region?.className).toContain('sr-only');
		expect(region?.className).not.toContain('hidden');
	});
});
