// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenshotSection } from './screenshot-section';

describe('ScreenshotSection', () => {
	it('renders image container with V2 max-w-5xl width and vertical padding tokens', () => {
		const { container } = render(
			<ScreenshotSection
				src="/placeholder.png"
				alt="Placeholder screenshot"
				caption="Example caption"
			/>,
		);

		const section = container.querySelector('section');
		expect(section?.className).toMatch(/py-14/);
		expect(section?.className).toMatch(/md:py-20/);

		const imageContainer = container.querySelector('[class*="max-w-5xl"]');
		expect(imageContainer).not.toBeNull();
	});

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
		fireEvent.error(img); // first failure retries the unoptimized asset
		fireEvent.error(img); // second failure (raw asset) hides the section

		// After the raw asset also fails, the component returns null
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

		const frame = container.querySelector('.relative');
		expect(frame?.className).toContain('bg-card');
	});

	it('renders no legend when annotations are not provided (delegation parity)', () => {
		const { container } = render(
			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="Dashboard"
				caption="Caption"
			/>,
		);

		expect(container.querySelector('ol')).toBeNull();
	});

	it('renders markers and legend when annotations are provided', () => {
		const { container } = render(
			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="Dashboard"
				caption="Caption"
				annotations={[
					{ x: 10, y: 20, label: 'Roster status' },
					{ x: 70, y: 55, label: 'Export button' },
				]}
			/>,
		);

		const items = Array.from(container.querySelectorAll('ol > li'));
		expect(items).toHaveLength(2);
		expect(items[0]?.textContent).toContain('Roster status');
		expect(items[1]?.textContent).toContain('Export button');
	});
});
