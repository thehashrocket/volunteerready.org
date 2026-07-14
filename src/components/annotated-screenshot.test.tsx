// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnnotatedScreenshot } from './annotated-screenshot';

const ANNOTATIONS = [
	{ x: 20, y: 30, label: 'First callout' },
	{ x: 62, y: 38, label: 'Second callout' },
	{ x: 85, y: 70, label: 'Third callout' },
];

describe('AnnotatedScreenshot', () => {
	it('renders the image without a legend when annotations are omitted', () => {
		const { container } = render(
			<AnnotatedScreenshot src="/marketing/dashboard.png" alt="Dashboard" />,
		);

		expect(screen.getByAltText('Dashboard')).toBeTruthy();
		expect(container.querySelector('ol')).toBeNull();
		expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
	});

	it('renders the image without a legend when annotations are empty', () => {
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/dashboard.png"
				alt="Dashboard"
				annotations={[]}
			/>,
		);

		expect(screen.getByAltText('Dashboard')).toBeTruthy();
		expect(container.querySelector('ol')).toBeNull();
	});

	it('positions numbered aria-hidden markers at the given percentages', () => {
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/dashboard.png"
				alt="Dashboard"
				annotations={ANNOTATIONS}
			/>,
		);

		const imageBox = container.querySelector('.relative');
		const markers = Array.from(
			imageBox?.querySelectorAll('[aria-hidden="true"]') ?? [],
		);
		expect(markers).toHaveLength(3);
		expect(markers.map((m) => m.textContent)).toEqual(['1', '2', '3']);
		expect((markers[1] as HTMLElement).style.left).toBe('62%');
		expect((markers[1] as HTMLElement).style.top).toBe('38%');
	});

	it('renders a legend list matching the markers 1:1', () => {
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/dashboard.png"
				alt="Dashboard"
				annotations={ANNOTATIONS}
			/>,
		);

		const items = Array.from(container.querySelectorAll('ol > li'));
		expect(items).toHaveLength(ANNOTATIONS.length);
		for (const [index, annotation] of ANNOTATIONS.entries()) {
			expect(items[index]?.textContent).toContain(annotation.label);
			expect(items[index]?.textContent).toContain(String(index + 1));
		}
	});

	it('retries unoptimized on first image error instead of hiding', () => {
		const onError = vi.fn();
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/missing.png"
				alt="Missing"
				annotations={ANNOTATIONS}
				onError={onError}
			/>,
		);

		fireEvent.error(screen.getByAltText('Missing'));

		// A transient optimizer failure degrades to the raw asset — the block
		// must survive the first error.
		expect(onError).not.toHaveBeenCalled();
		const img = container.querySelector('img');
		expect(img).not.toBeNull();
		// unoptimized retry serves the raw static path, not /_next/image
		expect(img?.getAttribute('src')).toMatch(/\/marketing\/missing\.png$/);
		expect(img?.getAttribute('src')).not.toContain('_next/image');
	});

	it('hides the whole block and notifies onError when the raw asset also fails', () => {
		const onError = vi.fn();
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/missing.png"
				alt="Missing"
				annotations={ANNOTATIONS}
				onError={onError}
			/>,
		);

		fireEvent.error(screen.getByAltText('Missing')); // optimizer failure → retry
		fireEvent.error(screen.getByAltText('Missing')); // raw asset failure → hide

		expect(onError).toHaveBeenCalledOnce();
		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('ol')).toBeNull();
	});

	it('passes the sizes hint through to the image', () => {
		render(
			<AnnotatedScreenshot
				src="/marketing/dashboard.png"
				alt="Dashboard"
				sizes="(max-width: 768px) 100vw, 600px"
			/>,
		);

		expect(screen.getByAltText('Dashboard').getAttribute('sizes')).toBe(
			'(max-width: 768px) 100vw, 600px',
		);
	});

	it('applies frameClassName to the image frame', () => {
		const { container } = render(
			<AnnotatedScreenshot
				src="/marketing/dashboard.png"
				alt="Dashboard"
				frameClassName="bg-card rounded-lg"
			/>,
		);

		const frame = container.querySelector('.relative');
		expect(frame?.className).toContain('bg-card');
		expect(frame?.className).toContain('overflow-hidden');
	});
});
