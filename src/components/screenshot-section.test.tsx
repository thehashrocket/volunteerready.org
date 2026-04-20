// @vitest-environment jsdom

import { render } from '@testing-library/react';
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
});
