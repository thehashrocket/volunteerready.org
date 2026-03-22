// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonLdFaq } from '../json-ld-faq';

describe('JsonLdFaq', () => {
	it('renders valid FAQ JSON-LD', () => {
		const faqs = [
			{ question: 'Is there a free tier?', answer: 'Yes, absolutely.' },
			{ question: 'Can I upgrade?', answer: 'You can upgrade anytime.' },
		];

		const { container } = render(<JsonLdFaq faqs={faqs} />);
		const script = container.querySelector(
			'script[type="application/ld+json"]',
		);
		expect(script).toBeTruthy();

		const data = JSON.parse(script!.textContent!.replace(/\\u003c/g, '<'));
		expect(data['@type']).toBe('FAQPage');
		expect(data.mainEntity).toHaveLength(2);
		expect(data.mainEntity[0]['@type']).toBe('Question');
		expect(data.mainEntity[0].name).toBe('Is there a free tier?');
		expect(data.mainEntity[0].acceptedAnswer.text).toBe('Yes, absolutely.');
	});

	it('handles empty FAQ array', () => {
		const { container } = render(<JsonLdFaq faqs={[]} />);
		const script = container.querySelector(
			'script[type="application/ld+json"]',
		);
		const data = JSON.parse(script!.textContent!.replace(/\\u003c/g, '<'));
		expect(data.mainEntity).toHaveLength(0);
	});
});
