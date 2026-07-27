// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AccountState } from '@/prisma/generated/client';
import { VolunteerStatusBadge } from './volunteer-status-badge';

const ALL_STATES: AccountState[] = ['ACTIVE', 'UNCLAIMED'];

describe('VolunteerStatusBadge', () => {
	it('renders the approved copy for UNCLAIMED', () => {
		render(<VolunteerStatusBadge state="UNCLAIMED" />);
		expect(screen.getByText('No account yet')).toBeInTheDocument();
	});

	it('renders the approved copy for ACTIVE', () => {
		render(<VolunteerStatusBadge state="ACTIVE" />);
		expect(screen.getByText('Has account')).toBeInTheDocument();
	});

	// The failure this component exists to prevent: shifts/page.tsx renders enum
	// values straight into badges, so coordinators see "WAITLISTED". If someone
	// later simplifies this to {state}, this test fails.
	it.each(ALL_STATES)('never renders the raw enum value for %s', (state) => {
		const { container } = render(<VolunteerStatusBadge state={state} />);
		expect(container.textContent).not.toContain(state);
		expect(container.textContent).not.toMatch(/^[A-Z_]+$/);
	});

	it('uses the inert neutral variant for UNCLAIMED, not warning', () => {
		// Having no account yet is a fact, not a problem needing attention.
		// warning-* here would make a 60-row roster look like a 60-item to-do list.
		const { container } = render(<VolunteerStatusBadge state="UNCLAIMED" />);
		const badge = container.firstElementChild;
		expect(badge?.className).toContain('neutral');
		expect(badge?.className).not.toContain('warning');
	});

	it('uses the success variant for ACTIVE', () => {
		const { container } = render(<VolunteerStatusBadge state="ACTIVE" />);
		expect(container.firstElementChild?.className).toContain('success');
	});

	it('merges a caller className instead of dropping it', () => {
		const { container } = render(
			<VolunteerStatusBadge state="ACTIVE" className="ml-2" />,
		);
		expect(container.firstElementChild?.className).toContain('ml-2');
	});

	it('marks the icon aria-hidden so the label carries the meaning', () => {
		const { container } = render(<VolunteerStatusBadge state="UNCLAIMED" />);
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
	});

	// Design spec: "No hex anywhere in the new surfaces." Semantic tokens all
	// carry .dark values, so variants are dark-mode correct and literals are not.
	// The marketing pipeline captures dark screenshots, so a hex would ship.
	it('contains no hardcoded hex colours', () => {
		const source = readFileSync(
			path.join(__dirname, 'volunteer-status-badge.tsx'),
			'utf-8',
		);
		expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
	});

	// Record<AccountState, …> already enforces this at compile time; this catches
	// a future enum value added with a `as any` cast or a loosened type.
	it('handles every AccountState without throwing', () => {
		for (const state of ALL_STATES) {
			expect(() =>
				render(<VolunteerStatusBadge state={state} />),
			).not.toThrow();
		}
	});
});
