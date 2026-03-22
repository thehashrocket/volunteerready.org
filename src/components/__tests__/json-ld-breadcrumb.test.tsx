// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonLdBreadcrumb } from '../json-ld-breadcrumb';

describe('JsonLdBreadcrumb', () => {
	it('renders valid breadcrumb JSON-LD', () => {
		const items = [
			{ label: 'Home', href: '/' },
			{ label: 'Pricing', href: '/pricing' },
		];

		const { container } = render(<JsonLdBreadcrumb items={items} />);
		const script = container.querySelector(
			'script[type="application/ld+json"]',
		);
		expect(script).toBeTruthy();

		const data = JSON.parse(script!.textContent!.replace(/\\u003c/g, '<'));
		expect(data['@type']).toBe('BreadcrumbList');
		expect(data.itemListElement).toHaveLength(2);
		expect(data.itemListElement[0].position).toBe(1);
		expect(data.itemListElement[0].name).toBe('Home');
		expect(data.itemListElement[1].position).toBe(2);
		expect(data.itemListElement[1].name).toBe('Pricing');
	});

	it('handles empty items array', () => {
		const { container } = render(<JsonLdBreadcrumb items={[]} />);
		const script = container.querySelector(
			'script[type="application/ld+json"]',
		);
		const data = JSON.parse(script!.textContent!.replace(/\\u003c/g, '<'));
		expect(data.itemListElement).toHaveLength(0);
	});
});
