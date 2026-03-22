// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema (extracted for direct testing — mirrors QuestionDialog.tsx)
// ---------------------------------------------------------------------------

const schema = z
	.object({
		prompt: z.string().min(5, 'At least 5 characters').max(500).trim(),
		type: z.string().optional(),
		required: z.boolean(),
		maxLength: z
			.union([
				z.number().int().min(1, 'Must be at least 1'),
				z.nan().transform((): undefined => undefined),
			])
			.optional(),
		options: z.array(z.object({ value: z.string() })).optional(),
		disqualifyIfFalse: z.boolean().optional(),
		disqualifierReason: z.string().max(200).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type === 'SINGLE_CHOICE') {
			const valid =
				data.options?.filter((o) => o.value.trim().length > 0) ?? [];
			if (valid.length < 2) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'At least 2 non-empty options required',
					path: ['options'],
				});
			}
		}
	});

// ---------------------------------------------------------------------------
// Schema unit tests
// ---------------------------------------------------------------------------

describe('QuestionDialog schema', () => {
	const baseValues = {
		prompt: 'Are you over 18?',
		required: true,
		options: [{ value: '' }, { value: '' }],
	};

	it('passes for BOOLEAN type with empty options (regression)', () => {
		const result = schema.safeParse({
			...baseValues,
			type: 'BOOLEAN',
			disqualifyIfFalse: true,
			disqualifierReason: 'Must be 18 or over',
		});
		expect(result.success).toBe(true);
	});

	it('passes for TEXT type with empty options (regression)', () => {
		const result = schema.safeParse({
			...baseValues,
			type: 'TEXT',
			maxLength: 500,
		});
		expect(result.success).toBe(true);
	});

	it('passes for SINGLE_CHOICE with valid options', () => {
		const result = schema.safeParse({
			...baseValues,
			type: 'SINGLE_CHOICE',
			options: [{ value: 'Yes' }, { value: 'No' }],
		});
		expect(result.success).toBe(true);
	});

	it('fails for SINGLE_CHOICE with fewer than 2 non-empty options', () => {
		const result = schema.safeParse({
			...baseValues,
			type: 'SINGLE_CHOICE',
			options: [{ value: 'Yes' }, { value: '' }],
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain('options');
		}
	});

	it('fails for SINGLE_CHOICE with no options', () => {
		const result = schema.safeParse({
			...baseValues,
			type: 'SINGLE_CHOICE',
			options: [],
		});
		expect(result.success).toBe(false);
	});

	it('fails when prompt is too short', () => {
		const result = schema.safeParse({
			...baseValues,
			prompt: 'Hi',
			type: 'BOOLEAN',
		});
		expect(result.success).toBe(false);
	});

	it('passes for BOOLEAN without disqualifier fields', () => {
		const result = schema.safeParse({
			prompt: 'Do you have a car?',
			type: 'BOOLEAN',
			required: false,
		});
		expect(result.success).toBe(true);
	});

	it('passes for TEXT without maxLength', () => {
		const result = schema.safeParse({
			prompt: 'Tell us about yourself',
			type: 'TEXT',
			required: true,
		});
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Component integration test
// ---------------------------------------------------------------------------

// Mock tRPC client before importing the component
const mockMutate = vi.fn();
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			createQuestion: {
				useMutation: () => ({
					mutate: mockMutate,
					isPending: false,
				}),
			},
			updateQuestion: {
				useMutation: () => ({
					mutate: vi.fn(),
					isPending: false,
				}),
			},
		},
	},
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

// Import after mocks
const { QuestionDialog } = await import('./QuestionDialog');

describe('QuestionDialog component', () => {
	afterEach(() => {
		cleanup();
		mockMutate.mockClear();
	});

	it('submits a BOOLEAN question successfully', async () => {
		const user = userEvent.setup();
		const onSaved = vi.fn();
		render(
			<QuestionDialog
				open={true}
				onOpenChange={vi.fn()}
				question={null}
				onSaved={onSaved}
			/>,
		);

		// Fill in the prompt (default type is BOOLEAN)
		const textarea = screen.getByPlaceholderText(
			'e.g. Are you 18 years or older?',
		);
		await user.clear(textarea);
		await user.type(textarea, 'Are you over 18 years old?');

		// Click submit
		const submitButton = screen.getByRole('button', { name: /add question/i });
		await user.click(submitButton);

		// Should have called the mutation
		expect(mockMutate).toHaveBeenCalledTimes(1);
		expect(mockMutate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: 'Are you over 18 years old?',
				type: 'BOOLEAN',
				required: true,
			}),
		);
	});

	it('does NOT submit when prompt is too short', async () => {
		const user = userEvent.setup();
		render(
			<QuestionDialog
				open={true}
				onOpenChange={vi.fn()}
				question={null}
				onSaved={vi.fn()}
			/>,
		);

		const textarea = screen.getByPlaceholderText(
			'e.g. Are you 18 years or older?',
		);
		await user.clear(textarea);
		await user.type(textarea, 'Hi');

		const submitButton = screen.getByRole('button', { name: /add question/i });
		await user.click(submitButton);

		expect(mockMutate).not.toHaveBeenCalled();
		// Error message should be visible
		expect(screen.getByText(/at least 5 characters/i)).toBeInTheDocument();
	});
});
