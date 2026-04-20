// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CTABanner } from './cta-banner';

describe('CTABanner', () => {
	it('renders a plain string heading', () => {
		render(
			<CTABanner
				heading="Ready to ship?"
				description="Get started in minutes."
				actions={<button type="button">Start</button>}
			/>,
		);

		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
			'Ready to ship?',
		);
	});

	it('renders a ReactNode heading with italic emphasis', () => {
		render(
			<CTABanner
				heading={
					<>
						Ready for your{' '}
						<em className="italic" data-testid="emphasis">
							volunteer team?
						</em>
					</>
				}
				description="Get started in minutes."
				actions={<button type="button">Start</button>}
			/>,
		);

		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading.textContent).toContain('volunteer team?');
		expect(screen.getByTestId('emphasis')).toHaveClass('italic');
	});
});
