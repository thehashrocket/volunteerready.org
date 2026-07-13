// @vitest-environment jsdom

/**
 * Component tests for OrgProfileForm — the 6A state table + 4A confirm flow
 * + 8A read-only mode + 14A aria wiring.
 */

import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutate, mockUseMutation, mockToast, mediaQueryState } = vi.hoisted(
	() => ({
		mockMutate: vi.fn(),
		mockUseMutation: vi.fn(),
		mockToast: { success: vi.fn(), error: vi.fn() },
		mediaQueryState: { isDesktop: true },
	}),
);

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		org: {
			updateOrgProfile: {
				useMutation: (
					opts: Parameters<typeof mockUseMutation>[0],
				): ReturnType<typeof mockUseMutation> => mockUseMutation(opts),
			},
		},
	},
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/lib/hooks/use-media-query', () => ({
	useMediaQuery: () => mediaQueryState.isDesktop,
}));

import { OrgProfileForm } from './org-profile-form';

// vaul's Drawer uses pointer capture, which jsdom doesn't implement
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);

type MutationOpts = {
	onSuccess: (org: { id: string; name: string; slug: string }) => void;
	onError: (err: { message: string; data?: { code?: string } }) => void;
};

let capturedOpts: MutationOpts;

beforeEach(() => {
	vi.clearAllMocks();
	mediaQueryState.isDesktop = true;
	mockUseMutation.mockImplementation((opts: MutationOpts) => {
		capturedOpts = opts;
		return { mutate: mockMutate, isPending: false };
	});
});

function renderForm(
	overrides: Partial<Parameters<typeof OrgProfileForm>[0]> = {},
) {
	return render(
		<OrgProfileForm
			initialName="Greenfield Community Center"
			initialSlug="greenfield"
			canEdit={true}
			{...overrides}
		/>,
	);
}

describe('OrgProfileForm', () => {
	it('disables Save while the form is pristine', () => {
		renderForm();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	});

	it('enables Save once dirty and valid', async () => {
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
	});

	it('normalizes slug input as you type (uppercase + spaces)', async () => {
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'My Org');
		expect(slug).toHaveValue('my-org');
	});

	it('shows the reserved-slug error inline and keeps Save disabled', async () => {
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'status');
		expect(
			await screen.findByText('This name is reserved'),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
		expect(slug).toHaveAttribute('aria-invalid', 'true');
		expect(slug).toHaveAttribute('aria-describedby', 'org-slug-error');
	});

	it('saves a name-only change without a confirmation dialog', async () => {
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(mockMutate).toHaveBeenCalledWith({
			name: 'Greenfield Community Center II',
			slug: 'greenfield',
		});
		expect(
			screen.queryByText('Change your apply link?'),
		).not.toBeInTheDocument();
	});

	it('opens the confirmation dialog on slug change, naming both URLs', async () => {
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'new-name');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(mockMutate).not.toHaveBeenCalled();
		expect(screen.getByText('Change your apply link?')).toBeInTheDocument();
		expect(
			screen.getByText(/old link .*greenfield.* will keep working/i),
		).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Change link' }));
		expect(mockMutate).toHaveBeenCalledWith({
			name: 'Greenfield Community Center',
			slug: 'new-name',
		});
	});

	it('cancelling the confirmation does not save', async () => {
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'new-name');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(mockMutate).not.toHaveBeenCalled();
	});

	it('maps a CONFLICT error to the inline taken message', async () => {
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		act(() => {
			capturedOpts.onError({
				message: 'This slug is already taken',
				data: { code: 'CONFLICT' },
			});
		});
		// Appears inline under the field AND in the aria-live region (14A)
		const matches = await screen.findAllByText('This slug is already taken');
		expect(matches.length).toBeGreaterThanOrEqual(2);
		expect(screen.getByLabelText('URL slug')).toHaveAttribute(
			'aria-invalid',
			'true',
		);
	});

	it('shows a retryable banner on server/network errors, preserving values', async () => {
		const user = userEvent.setup();
		renderForm();
		const name = screen.getByLabelText('Organization name');
		await user.type(name, ' II');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		act(() => {
			capturedOpts.onError({
				message: 'Internal server error',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			});
		});
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"Couldn't save — try again",
		);
		expect(name).toHaveValue('Greenfield Community Center II');
	});

	it('updates the live apply link and toasts the new-URL moment after a slug change', async () => {
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'new-name');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await user.click(screen.getByRole('button', { name: 'Change link' }));

		act(() => {
			capturedOpts.onSuccess({
				id: 'org1',
				name: 'Greenfield Community Center',
				slug: 'new-name',
			});
		});

		await waitFor(() => {
			expect(mockToast.success).toHaveBeenCalledWith(
				'Organization updated — your apply link has changed',
			);
		});
		// Appears in both the live-URL anchor and the aria-live region
		expect(
			screen.getAllByText(/volunteerready\.org\/apply\/new-name/).length,
		).toBeGreaterThan(0);
	});

	it('renders read-only values without a form for non-admin staff (8A)', () => {
		renderForm({ canEdit: false });
		expect(
			screen.queryByRole('button', { name: 'Save' }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText('Organization name'),
		).not.toBeInTheDocument();
		expect(screen.getByText('Greenfield Community Center')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Only owners and admins can edit the organization profile.',
			),
		).toBeInTheDocument();
	});

	it('copy button still renders in read-only mode', () => {
		renderForm({ canEdit: false });
		expect(
			screen.getByRole('button', { name: 'Copy apply link' }),
		).toBeInTheDocument();
	});

	it('maps a BAD_REQUEST server rejection to an inline slug error', async () => {
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		act(() => {
			capturedOpts.onError({
				message: 'This name is reserved',
				data: { code: 'BAD_REQUEST' },
			});
		});
		const matches = await screen.findAllByText('This name is reserved');
		expect(matches.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByLabelText('URL slug')).toHaveAttribute(
			'aria-invalid',
			'true',
		);
	});

	it('shows the in-flight Saving state and disables the button', async () => {
		mockUseMutation.mockImplementation((opts: MutationOpts) => {
			capturedOpts = opts;
			return { mutate: mockMutate, isPending: true };
		});
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		const saving = screen.getByRole('button', { name: /Saving/ });
		expect(saving).toBeDisabled();
	});

	it('registers a beforeunload guard while dirty (7B)', async () => {
		const user = userEvent.setup();
		renderForm();
		// Pristine: event not prevented
		const before = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(before);
		expect(before.defaultPrevented).toBe(false);
		// Dirty: event prevented
		await user.type(screen.getByLabelText('Organization name'), ' II');
		const after = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(after);
		expect(after.defaultPrevented).toBe(true);
	});

	it('intercepts internal link clicks while dirty and respects Cancel (7B)', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const user = userEvent.setup();
		const { container } = renderForm();
		const link = document.createElement('a');
		link.href = '/app/settings/team';
		link.textContent = 'Team';
		// jsdom can't navigate; swallow the default at the end of the bubble
		// phase so the capture-phase guard under test still runs first.
		link.addEventListener('click', (e) => e.preventDefault());
		container.appendChild(link);

		// Pristine: no confirm prompt
		await user.click(link);
		expect(confirmSpy).not.toHaveBeenCalled();

		// Dirty: confirm fires; returning false blocks navigation
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(link);
		expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
		confirmSpy.mockRestore();
	});

	it('copies the full apply URL and shows the copied state', async () => {
		const user = userEvent.setup();
		// Define AFTER userEvent.setup() — setup installs its own clipboard stub
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});
		renderForm();
		await user.click(screen.getByRole('button', { name: 'Copy apply link' }));
		expect(writeText).toHaveBeenCalledWith(
			expect.stringMatching(/\/apply\/greenfield$/),
		);
	});

	it('shows an error toast when the clipboard write fails', async () => {
		const user = userEvent.setup();
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});
		renderForm();
		await user.click(screen.getByRole('button', { name: 'Copy apply link' }));
		await waitFor(() => {
			expect(mockToast.error).toHaveBeenCalledWith("Couldn't copy the link");
		});
	});

	it('releases the beforeunload guard after a successful save (7B disarm)', async () => {
		const user = userEvent.setup();
		renderForm();
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		act(() => {
			capturedOpts.onSuccess({
				id: 'org1',
				name: 'Greenfield Community Center II',
				slug: 'greenfield',
			});
		});
		const evt = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(evt);
		expect(evt.defaultPrevented).toBe(false);
	});

	it('allows navigation when the discard confirm is accepted (7B)', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const user = userEvent.setup();
		const { container } = renderForm();
		const link = document.createElement('a');
		link.href = '/app/settings/team';
		link.textContent = 'Team';
		let prevented = false;
		link.addEventListener('click', (e) => {
			prevented = e.defaultPrevented;
			e.preventDefault(); // jsdom can't navigate
		});
		container.appendChild(link);
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.click(link);
		expect(confirmSpy).toHaveBeenCalled();
		expect(prevented).toBe(false);
		confirmSpy.mockRestore();
	});

	it('lets modified clicks (new tab) through without a discard prompt (7B)', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const user = userEvent.setup();
		const { container } = renderForm();
		const link = document.createElement('a');
		link.href = '/app/settings/team';
		link.addEventListener('click', (e) => e.preventDefault());
		container.appendChild(link);
		await user.type(screen.getByLabelText('Organization name'), ' II');
		await user.keyboard('{Meta>}');
		await user.click(link);
		await user.keyboard('{/Meta}');
		expect(confirmSpy).not.toHaveBeenCalled();
		confirmSpy.mockRestore();
	});

	it('uses the Drawer confirm on mobile (13A)', async () => {
		mediaQueryState.isDesktop = false;
		const user = userEvent.setup();
		renderForm();
		const slug = screen.getByLabelText('URL slug');
		await user.clear(slug);
		await user.type(slug, 'new-name');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		// Drawer renders the same confirm content via the mobile branch.
		// fireEvent (not userEvent) — vaul's pointer-release handler reads a
		// computed transform jsdom doesn't implement.
		expect(screen.getByText('Change your apply link?')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Change link' }));
		expect(mockMutate).toHaveBeenCalledWith({
			name: 'Greenfield Community Center',
			slug: 'new-name',
		});
	});
});
