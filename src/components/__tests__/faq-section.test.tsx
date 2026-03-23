// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { FaqSection } from '../faq-section';

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

describe('FaqSection', () => {
	const faqs = [
		{ question: 'Is there a free tier?', answer: 'Yes, absolutely.' },
		{ question: 'Can I upgrade later?', answer: 'You can upgrade anytime.' },
	];

	it('renders all FAQ items', () => {
		render(<FaqSection faqs={faqs} />);
		expect(screen.getByText('Is there a free tier?')).toBeTruthy();
		expect(screen.getByText('Can I upgrade later?')).toBeTruthy();
	});

	it('first FAQ is open by default', () => {
		const { container } = render(<FaqSection faqs={faqs} />);
		const details = container.querySelectorAll('details');
		expect(details[0].hasAttribute('open')).toBe(true);
		expect(details[1].hasAttribute('open')).toBe(false);
	});

	it('generates deep-link IDs from questions', () => {
		const { container } = render(<FaqSection faqs={faqs} />);
		const details = container.querySelectorAll('details');
		expect(details[0].id).toBe('is-there-a-free-tier');
		expect(details[1].id).toBe('can-i-upgrade-later');
	});

	it('includes JSON-LD structured data', () => {
		const { container } = render(<FaqSection faqs={faqs} />);
		const script = container.querySelector(
			'script[type="application/ld+json"]',
		);
		expect(script).toBeTruthy();
	});
});
