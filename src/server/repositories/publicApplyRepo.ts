import type {
	PublicOrgSummary,
	PublicQuestionType,
	PublicScreenerQuestion,
} from '@/server/domain/screener/publicForm';
import { prisma } from '@/server/repositories/prisma';

const mapQuestionType = (type: string): PublicQuestionType => {
	switch (type) {
		case 'BOOLEAN':
			return 'YES_NO';
		case 'SINGLE_CHOICE':
			return 'SINGLE_SELECT';
		case 'TEXT':
		default:
			return 'TEXT';
	}
};

export async function getPublicFormByOrgSlug(orgSlug: string): Promise<{
	org: PublicOrgSummary | null;
	questions: PublicScreenerQuestion[];
}> {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true, name: true, slug: true },
	});

	if (!org) {
		return { org: null, questions: [] };
	}

	const questionRecords = await prisma.screenerQuestion.findMany({
		where: { orgId: org.id, isActive: true },
		orderBy: { order: 'asc' },
		select: {
			id: true,
			key: true,
			prompt: true,
			type: true,
			order: true,
			configJson: true,
		},
	});

	const questions = questionRecords.map((question) => {
		const config =
			question.configJson && typeof question.configJson === 'object'
				? (question.configJson as Record<string, unknown>)
				: {};

		return {
			id: question.id,
			key: question.key,
			prompt: question.prompt,
			type: mapQuestionType(String(question.type)),
			order: question.order,
			configJson: {
				options: Array.isArray(config.options)
					? (config.options as string[])
					: undefined,
				required: config.required ?? true,
				maxLength:
					typeof config.maxLength === 'number' ? config.maxLength : undefined,
			},
		} satisfies PublicScreenerQuestion;
	});

	return { org, questions };
}
