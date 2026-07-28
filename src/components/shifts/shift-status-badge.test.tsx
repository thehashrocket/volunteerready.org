// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	SHIFT_STATUS_LABELS,
	type ShiftStatus,
	SIGNUP_STATUS_LABELS,
	type SignupStatus,
} from '@/server/domain/shift';
import { ShiftStatusBadge, SignupStatusBadge } from './shift-status-badge';

const SHIFT_STATUSES = Object.keys(SHIFT_STATUS_LABELS) as ShiftStatus[];
const SIGNUP_STATUSES = Object.keys(SIGNUP_STATUS_LABELS) as SignupStatus[];

describe('ShiftStatusBadge', () => {
	it.each(SHIFT_STATUSES)('renders human copy for %s', (status) => {
		render(<ShiftStatusBadge status={status} />);

		expect(screen.getByText(SHIFT_STATUS_LABELS[status])).toBeInTheDocument();
	});

	// The regression these components exist for: the previous inline maps used
	// the enum value itself as the label, so a coordinator read COMPLETED.
	it.each(SHIFT_STATUSES)('never renders the raw enum %s', (status) => {
		const { container } = render(<ShiftStatusBadge status={status} />);

		expect(container.textContent).not.toContain(status);
	});
});

describe('SignupStatusBadge', () => {
	it.each(SIGNUP_STATUSES)('renders human copy for %s', (status) => {
		render(<SignupStatusBadge status={status} />);

		expect(screen.getByText(SIGNUP_STATUS_LABELS[status])).toBeInTheDocument();
	});

	it.each([
		'WAITLISTED',
		'NO_SHOW',
	] as const)('never renders the raw enum %s', (status) => {
		const { container } = render(<SignupStatusBadge status={status} />);

		expect(container.textContent).not.toContain(status);
	});
});

it('uses semantic tokens only, so dark mode comes free', () => {
	// Same guard VolunteerStatusBadge carries. A hex literal renders correctly in
	// light mode and wrongly in dark, and the marketing pipeline captures dark
	// screenshots — so it would eventually surface in one.
	const source = readFileSync(
		path.join(__dirname, 'shift-status-badge.tsx'),
		'utf-8',
	);

	expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
});
