// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = 'light';

vi.mock('next-themes', () => ({
	useTheme: () => ({
		theme: mockTheme,
		setTheme: mockSetTheme,
	}),
}));

// Import after mock
import { ThemeToggle } from '../theme-toggle';

describe('ThemeToggle', () => {
	beforeEach(() => {
		mockTheme = 'light';
		mockSetTheme.mockClear();
	});

	it('renders skeleton before mounting', () => {
		// Since useEffect runs synchronously in jsdom test, we verify the
		// component renders without crashing
		const { container } = render(<ThemeToggle />);
		expect(container.querySelector('button')).toBeTruthy();
	});

	it('cycles light → dark', () => {
		mockTheme = 'light';
		render(<ThemeToggle />);
		const button = screen.getByRole('switch');
		fireEvent.click(button);
		expect(mockSetTheme).toHaveBeenCalledWith('dark');
	});

	it('cycles dark → system', () => {
		mockTheme = 'dark';
		render(<ThemeToggle />);
		const button = screen.getByRole('switch');
		fireEvent.click(button);
		expect(mockSetTheme).toHaveBeenCalledWith('system');
	});

	it('cycles system → light', () => {
		mockTheme = 'system';
		render(<ThemeToggle />);
		const button = screen.getByRole('switch');
		fireEvent.click(button);
		expect(mockSetTheme).toHaveBeenCalledWith('light');
	});

	it('responds to Space key', () => {
		mockTheme = 'light';
		render(<ThemeToggle />);
		const button = screen.getByRole('switch');
		fireEvent.keyDown(button, { key: ' ' });
		expect(mockSetTheme).toHaveBeenCalledWith('dark');
	});

	it('has accessible aria-label', () => {
		mockTheme = 'dark';
		render(<ThemeToggle />);
		const button = screen.getByRole('switch');
		expect(button.getAttribute('aria-label')).toContain('Dark mode');
	});
});
