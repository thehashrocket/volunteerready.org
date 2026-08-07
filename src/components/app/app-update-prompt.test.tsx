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
	// The default fixture carries NO notes on purpose: that is the common
	// release, and it is the fallback path the rest of this file exercises.
	// Note-bearing cases opt in explicitly below.
	notes: [],
	olderNoteCount: 0,
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

describe('what changed', () => {
	const NOTE = { version: '0.42.0.0', summary: 'You can now export a roster.' };

	it('leads with the summary instead of the generic sentence', () => {
		// The whole point of this release. "VolunteerReady has been updated"
		// gives a coordinator nothing to weigh against losing unsaved work.
		renderPrompt({ notes: [NOTE] });
		expect(strip()).toHaveTextContent('You can now export a roster.');
	});

	it('keeps the unsaved-work warning alongside the summary', () => {
		// Easy to lose while rewriting the copy, and it is the only thing
		// standing between `Reload` and someone's half-typed form.
		renderPrompt({ notes: [NOTE] });
		expect(strip()).toHaveTextContent(/anything unsaved will be lost/i);
	});

	it('falls back to the generic sentence when the release has no note', () => {
		// The common case: most releases carry no note at all.
		renderPrompt({ notes: [] });
		expect(strip()).toHaveTextContent('VolunteerReady has been updated.');
	});

	it('does not show the generic sentence when a summary exists', () => {
		// Both would read as two unrelated claims stacked in one band.
		renderPrompt({ notes: [NOTE] });
		expect(strip()).not.toHaveTextContent('VolunteerReady has been updated.');
	});

	it('counts further notes rather than listing them', () => {
		// DESIGN.md's ambient strip is one line with no title; a stacked list is
		// the squashed card that rule exists to prevent.
		renderPrompt({
			notes: [NOTE, { version: '0.41.0.0', summary: 'Older thing.' }],
		});
		expect(strip()).toHaveTextContent('Plus 1 more update.');
		expect(strip()).not.toHaveTextContent('Older thing.');
	});

	it('includes notes the server’s wire cap dropped in the count', () => {
		// Otherwise a coordinator ten releases behind is told there was one
		// other change. The cap is reported, never silent.
		renderPrompt({
			notes: [NOTE, { version: '0.41.0.0', summary: 'Older.' }],
			olderNoteCount: 4,
		});
		expect(strip()).toHaveTextContent('Plus 5 more updates.');
	});

	it('says nothing about extras when there is only one note', () => {
		renderPrompt({ notes: [NOTE] });
		expect(strip()).not.toHaveTextContent(/Plus \d+ more/);
	});

	it('says nothing about extras when there are no notes at all', () => {
		// `olderNoteCount` without any notes would otherwise render "Plus 4 more
		// updates." with nothing for them to be additional TO.
		renderPrompt({ notes: [], olderNoteCount: 4 });
		expect(strip()).not.toHaveTextContent(/Plus \d+ more/);
	});

	it('announces the summary to screen readers, not just the interruption', () => {
		renderPrompt({ notes: [NOTE] });
		expect(screen.getByRole('status')).toHaveTextContent(
			'A new version of VolunteerReady is available. You can now export a roster.',
		);
	});

	it('announces the plain sentence when there is no summary', () => {
		renderPrompt({ notes: [] });
		expect(screen.getByRole('status')).toHaveTextContent(
			'A new version of VolunteerReady is available.',
		);
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
