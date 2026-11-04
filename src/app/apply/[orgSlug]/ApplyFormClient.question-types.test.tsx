// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	type ScreenerQuestion,
	validateResponses,
} from '@/server/domain/volunteer-screening';

// Unlike ApplyFormClient.test.tsx, this file runs the REAL form schema and
// the REAL screening validator: the bug was a mismatch between the two.

const mutate = vi.fn();

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			checkExistingApplication: {
				useQuery: () => ({ data: null, isLoading: false }),
			},
			checkAnonymousApplication: {
				useQuery: () => ({ data: null, isLoading: false }),
			},
			submit: { useMutation: () => ({ mutate, isPending: false }) },
		},
	},
}));
vi.mock('next/link', () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: ApplyFormClient } = await import('./ApplyFormClient');

const QUESTIONS = [
	{
		id: 'q-hours',
		key: 'hours',
		prompt: 'How many hours a month can you give?',
		type: 'NUMBER' as const,
		order: 0,
		configJson: { required: true },
	},
	{
		id: 'q-roles',
		key: 'roles',
		prompt: 'Which roles interest you?',
		type: 'MULTI_SELECT' as const,
		order: 1,
		configJson: {
			required: true,
			options: ['Dog walking', 'Front desk', 'Events'],
		},
	},
];

// The same questions as screening stores them.
const STORED: ScreenerQuestion[] = [
	{
		id: 'q-hours',
		prompt: QUESTIONS[0].prompt,
		type: 'NUMBER',
		required: true,
	},
	{
		id: 'q-roles',
		prompt: QUESTIONS[1].prompt,
		type: 'MULTI_CHOICE',
		options: QUESTIONS[1].configJson.options,
		required: true,
	},
];

async function fillProfile(user: ReturnType<typeof userEvent.setup>) {
	const fields: Record<string, string> = {
		'profile.name': 'Pat Doe',
		'profile.email': 'pat@example.com',
		'profile.phone': '555-0100',
		'profile.county': 'San Joaquin',
		'profile.availability': 'Weekends',
		'profile.experienceLevel': 'Some',
	};
	for (const [id, value] of Object.entries(fields)) {
		const el = document.getElementById(id) as HTMLInputElement;
		await user.type(el, value);
	}
}

afterEach(() => {
	cleanup();
	mutate.mockClear();
});

describe('ApplyFormClient: number and multi-choice questions', () => {
	it('renders a number input and one checkbox per option', () => {
		render(
			<ApplyFormClient
				org={{ id: 'org-1', name: 'Shelter', slug: 'shelter' }}
				questions={QUESTIONS}
				opportunity={null}
			/>,
		);

		expect(
			screen.getByLabelText('How many hours a month can you give?'),
		).toHaveAttribute('type', 'number');
		expect(
			screen.getByRole('group', { name: 'Which roles interest you?' }),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole('checkbox', {
				name: /Dog walking|Front desk|Events/,
			}),
		).toHaveLength(3);
	});

	it('submits answers that screening accepts', async () => {
		const user = userEvent.setup();
		render(
			<ApplyFormClient
				org={{ id: 'org-1', name: 'Shelter', slug: 'shelter' }}
				questions={QUESTIONS}
				opportunity={null}
			/>,
		);

		await fillProfile(user);
		await user.type(
			screen.getByLabelText('How many hours a month can you give?'),
			'6',
		);
		await user.click(screen.getByRole('checkbox', { name: 'Dog walking' }));
		await user.click(screen.getByRole('checkbox', { name: 'Events' }));
		await user.click(screen.getByRole('button', { name: /submit/i }));

		await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
		const { responses } = mutate.mock.calls[0][0] as {
			responses: Array<{ questionId: string; value: unknown }>;
		};
		expect(responses).toEqual([
			{ questionId: 'q-hours', value: 6 },
			{ questionId: 'q-roles', value: ['Dog walking', 'Events'] },
		]);
		expect(validateResponses(STORED, responses).success).toBe(true);
	});

	it('blocks submit until a required multi-choice has a selection', async () => {
		const user = userEvent.setup();
		render(
			<ApplyFormClient
				org={{ id: 'org-1', name: 'Shelter', slug: 'shelter' }}
				questions={QUESTIONS}
				opportunity={null}
			/>,
		);

		await fillProfile(user);
		await user.type(
			screen.getByLabelText('How many hours a month can you give?'),
			'6',
		);
		await user.click(screen.getByRole('button', { name: /submit/i }));

		expect(await screen.findByText('Select at least one')).toBeInTheDocument();
		expect(mutate).not.toHaveBeenCalled();
	});
});
