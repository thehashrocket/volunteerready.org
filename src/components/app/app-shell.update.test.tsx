// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUpdateState } from '@/lib/hooks/use-app-update-check';

/**
 * The wiring T6 is, which every other test in this feature is blind to.
 *
 * `app-update-prompt.test.tsx` proves the strip behaves correctly GIVEN its
 * props. Nothing there can catch the strip being mounted in the wrong place,
 * gated on the wrong condition, or shown to the wrong audience — and the
 * audience mistake is the one this plan already made once: the strip was
 * staff-gated while the account-menu item was not, so because `severity`
 * defaults to `silent`, version information reached exactly the population it
 * was designed to exclude and nobody else.
 */

const updateState = vi.hoisted(() => ({
	current: {
		isUpdateAvailable: true,
		deployedBuildId: 'build-b',
		deployedVersion: '0.42.0.0',
		severity: 'notice',
	} as AppUpdateState,
}));

const pathname = vi.hoisted(() => ({ current: '/app' }));

vi.mock('@/lib/hooks/use-app-update-check', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useAppUpdateCheck: () => updateState.current,
}));
vi.mock('@/lib/hooks/use-modal-open', () => ({ useModalOpen: () => false }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));
vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { email: 'staff@example.com' } } }),
	signOut: vi.fn(),
}));
vi.mock('@/components/app/app-sidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/app/notification-bell', () => ({
	NotificationBell: () => null,
}));
vi.mock('@/components/org/OrgSwitcher', () => ({ OrgSwitcher: () => null }));
vi.mock('@/components/company/CompanySwitcher', () => ({
	CompanySwitcher: () => null,
}));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));

const { AppShell } = await import('@/components/app/app-shell');

function renderShell(props: { hasOrg?: boolean; hasCompany?: boolean } = {}) {
	return render(
		<AppShell
			hasOrg={props.hasOrg ?? true}
			hasCompany={props.hasCompany ?? false}
		>
			<p>page content</p>
		</AppShell>,
	);
}

const strip = () => screen.queryByTestId('app-update-prompt');

beforeEach(() => {
	window.localStorage.clear();
	window.sessionStorage.clear();
	pathname.current = '/app';
	updateState.current = {
		isUpdateAvailable: true,
		deployedBuildId: 'build-b',
		deployedVersion: '0.42.0.0',
		severity: 'notice',
	};
});

describe('the strip inside the shell', () => {
	it('renders for org staff', () => {
		renderShell();
		expect(strip()).toBeInTheDocument();
	});

	it('renders for company staff', () => {
		renderShell({ hasOrg: false, hasCompany: true });
		expect(strip()).toBeInTheDocument();
	});

	it('renders NOTHING for a volunteer', () => {
		// Volunteers reach AppShell on six NO_ORG_EXEMPT_PREFIXES routes, so
		// this is a live path, not a theoretical one.
		renderShell({ hasOrg: false, hasCompany: false });
		expect(strip()).not.toBeInTheDocument();
	});

	it('is suppressed on /app/scan', () => {
		// The QR check-in scanner, used at a live event.
		pathname.current = '/app/scan';
		renderShell();
		expect(strip()).not.toBeInTheDocument();
	});

	it('sits BELOW the header and ABOVE the main content', () => {
		// Order is the decision here: an impersonation banner is a live
		// security-state warning and must never end up below a software-update
		// notice. Asserted by document position rather than by reading classes.
		const { container } = renderShell();
		const header = container.querySelector('header');
		const band = screen.getByTestId('app-update-prompt');
		const main = container.querySelector('main');

		expect(header?.compareDocumentPosition(band)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		expect(band.compareDocumentPosition(main as Node)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it('is not inside the header, so it cannot cover the nav toggle', () => {
		const { container } = renderShell();
		const header = container.querySelector('header');
		expect(header?.contains(screen.getByTestId('app-update-prompt'))).toBe(
			false,
		);
	});
});

describe('the account-menu affordance', () => {
	async function openAccountMenu() {
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: /staff@example.com/ }));
	}

	it('offers Update available with the version, for staff', async () => {
		renderShell();
		await openAccountMenu();
		expect(await screen.findByText('Update available')).toBeInTheDocument();
		expect(screen.getByText('0.42.0.0')).toBeInTheDocument();
	});

	it('is gated on the SAME condition as the strip', async () => {
		// The contradiction this closes: the menu item was originally ungated
		// while the strip was staff-only. Because most releases are `silent`,
		// the menu item is the only surface that renders — so an ungated item
		// showed version information to volunteers and nothing to staff.
		renderShell({ hasOrg: false, hasCompany: false });
		await openAccountMenu();
		expect(screen.queryByText('Update available')).not.toBeInTheDocument();
	});

	it('survives dismissal of the strip', async () => {
		// Dismissing means "stop interrupting me", not "forget this happened".
		const user = userEvent.setup();
		renderShell();
		await user.click(screen.getByRole('button', { name: 'Not now' }));
		expect(strip()).not.toBeInTheDocument();

		await openAccountMenu();
		expect(await screen.findByText('Update available')).toBeInTheDocument();
	});

	it('appears for a SILENT release, when the strip does not', async () => {
		// The default case, and the reason 22 and 23 solve each other.
		updateState.current = { ...updateState.current, severity: 'silent' };
		renderShell();
		expect(strip()).not.toBeInTheDocument();

		await openAccountMenu();
		expect(await screen.findByText('Update available')).toBeInTheDocument();
	});

	it('is absent when no update is pending', async () => {
		updateState.current = { ...updateState.current, isUpdateAvailable: false };
		renderShell();
		await openAccountMenu();
		expect(screen.queryByText('Update available')).not.toBeInTheDocument();
	});
});
