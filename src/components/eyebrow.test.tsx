// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Eyebrow } from './eyebrow';

describe('Eyebrow', () => {
	it('renders children', () => {
		render(<Eyebrow>Our story</Eyebrow>);

		expect(screen.getByText('Our story')).toBeInTheDocument();
	});

	it('renders as a <p> by default', () => {
		render(<Eyebrow>Default tag</Eyebrow>);

		const el = screen.getByText('Default tag');
		expect(el.tagName).toBe('P');
	});

	it('renders as the tag passed via `as`', () => {
		const { rerender } = render(<Eyebrow as="h2">Heading tag</Eyebrow>);
		expect(screen.getByText('Heading tag').tagName).toBe('H2');

		rerender(<Eyebrow as="dt">Term tag</Eyebrow>);
		expect(screen.getByText('Term tag').tagName).toBe('DT');
	});

	it('applies the primary/70 color for tone="primary"', () => {
		render(<Eyebrow tone="primary">Primary tone</Eyebrow>);

		expect(screen.getByText('Primary tone').className).toMatch(
			/text-primary\/70/,
		);
	});

	it('applies the muted-foreground color by default (tone="muted")', () => {
		render(<Eyebrow>Muted tone</Eyebrow>);

		expect(screen.getByText('Muted tone').className).toMatch(
			/text-muted-foreground/,
		);
	});

	it('always applies the canonical font/tracking treatment regardless of tone', () => {
		render(<Eyebrow tone="primary">Styled</Eyebrow>);

		const el = screen.getByText('Styled');
		expect(el.className).toMatch(/uppercase/);
		expect(el.className).toMatch(/tracking-\[0\.25em\]/);
		expect(el.className).toMatch(/font-semibold/);
		expect(el.className).not.toMatch(/font-mono/);
	});

	it('merges a custom className without dropping the canonical classes', () => {
		render(<Eyebrow className="mb-4">With margin</Eyebrow>);

		const el = screen.getByText('With margin');
		expect(el.className).toMatch(/mb-4/);
		expect(el.className).toMatch(/uppercase/);
	});

	it('lets a custom className override the tone color for dark backgrounds', () => {
		render(
			<Eyebrow tone="primary" className="text-primary-foreground/60">
				On dark background
			</Eyebrow>,
		);

		const el = screen.getByText('On dark background');
		expect(el.className).toMatch(/text-primary-foreground\/60/);
		expect(el.className).not.toMatch(/text-primary\/70/);
	});
});
