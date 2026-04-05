// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ScreenshotSection } from '../screenshot-section';

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
	globalThis.IntersectionObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof IntersectionObserver;
});

describe('ScreenshotSection', () => {
	it('renders image with caption', () => {
		render(
			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="Dashboard screenshot"
				caption="Your org dashboard"
			/>,
		);

		expect(screen.getByAltText('Dashboard screenshot')).toBeTruthy();
		expect(screen.getByText('Your org dashboard')).toBeTruthy();
	});

	it('hides section on image error', () => {
		const { container } = render(
			<ScreenshotSection
				src="/marketing/missing.png"
				alt="Missing screenshot"
				caption="Should disappear"
			/>,
		);

		const img = screen.getByAltText('Missing screenshot');
		fireEvent.error(img);

		// After error, component returns null
		expect(container.querySelector('section')).toBeNull();
	});

	it('applies sand section background when specified', () => {
		const { container } = render(
			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="Dashboard"
				caption="Caption"
				sectionBg="sand"
				containerBg="white"
			/>,
		);

		const section = container.querySelector('section');
		expect(section?.className).toContain('bg-muted');
	});
});
