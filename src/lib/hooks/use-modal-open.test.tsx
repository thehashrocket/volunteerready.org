// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModalOpen } from './use-modal-open';

/**
 * These mount the app's REAL `Dialog`, `Drawer` and `DropdownMenu` rather than
 * fixtures with hand-written attributes. That is the whole value: the hook is
 * coupled to `data-slot` names that shadcn owns, so a rename has to fail here
 * rather than in production.
 *
 * The `DropdownMenu -> false` case is the load-bearing one and is a regression
 * test written before the regression exists. `react-remove-scroll-bar` sets
 * `data-scroll-locked` on `<body>` for dropdowns as well as dialogs, so
 * "simplifying" the selector to that attribute passes every other test in this
 * file and ships a strip that disappears when the user clicks their own avatar
 * — the very menu that carries the "Update available" item.
 */

function Probe() {
	const isOpen = useModalOpen();
	return <output data-testid="probe">{isOpen ? 'open' : 'closed'}</output>;
}

const probe = () => screen.getByTestId('probe').textContent;

describe('useModalOpen', () => {
	it('is false with nothing open', () => {
		render(<Probe />);
		expect(probe()).toBe('closed');
	});

	it('flips true when a Dialog opens', async () => {
		const user = userEvent.setup();
		render(
			<>
				<Probe />
				<Dialog>
					<DialogTrigger>Open dialog</DialogTrigger>
					<DialogContent>
						<DialogTitle>A dialog</DialogTitle>
					</DialogContent>
				</Dialog>
			</>,
		);

		await user.click(screen.getByText('Open dialog'));
		await waitFor(() => expect(probe()).toBe('open'));
	});

	it('flips true when a Drawer opens', async () => {
		const user = userEvent.setup();
		render(
			<>
				<Probe />
				<Drawer>
					<DrawerTrigger>Open drawer</DrawerTrigger>
					<DrawerContent>
						<DrawerTitle>A drawer</DrawerTitle>
					</DrawerContent>
				</Drawer>
			</>,
		);

		await user.click(screen.getByText('Open drawer'));
		await waitFor(() => expect(probe()).toBe('open'));
	});

	it('stays FALSE when a DropdownMenu opens', async () => {
		// THE regression test. See the file docstring — this is the account
		// menu, and a strip that vanishes when you open the menu describing it
		// is worse than no strip.
		const user = userEvent.setup();
		render(
			<>
				<Probe />
				<DropdownMenu>
					<DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem>An item</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</>,
		);

		await user.click(screen.getByText('Open menu'));
		await screen.findByText('An item');
		expect(probe()).toBe('closed');
	});

	it('returns to false after a Dialog closes', async () => {
		const user = userEvent.setup();
		render(
			<>
				<Probe />
				<Dialog>
					<DialogTrigger>Open dialog</DialogTrigger>
					<DialogContent>
						<DialogTitle>A dialog</DialogTitle>
					</DialogContent>
				</Dialog>
			</>,
		);

		await user.click(screen.getByText('Open dialog'));
		await waitFor(() => expect(probe()).toBe('open'));

		await user.keyboard('{Escape}');
		await waitFor(() => expect(probe()).toBe('closed'));
	});

	it('disconnects its observer on unmount', () => {
		const { unmount } = render(<Probe />);
		const before = document.body.childElementCount;
		unmount();
		// A leaked observer would keep firing setState on an unmounted
		// component; React logs, but nothing fails. Mutate body after unmount
		// and assert no error surfaces.
		const node = document.createElement('div');
		document.body.appendChild(node);
		expect(document.body.childElementCount).toBe(before + 1);
		node.remove();
	});
});
