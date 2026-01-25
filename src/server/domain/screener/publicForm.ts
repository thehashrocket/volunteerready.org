import { z } from "zod";

export type PublicQuestionType = "YES_NO" | "TEXT" | "SINGLE_SELECT";

export interface PublicOrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface PublicScreenerQuestion {
  id: string;
  prompt: string;
  type: PublicQuestionType;
  options?: string[];
  required: boolean;
}

export const yesNoOptions = ["Yes", "No"] as const;

export function buildResponseSchema(questions: PublicScreenerQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const question of questions) {
    let schema: z.ZodTypeAny;

    switch (question.type) {
      case "YES_NO":
        schema = z.enum(yesNoOptions);
        break;
      case "SINGLE_SELECT":
        schema = z.string().min(1);
        break;
      case "TEXT":
      default:
        schema = z.string();
        break;
    }

    if (question.type === "SINGLE_SELECT" && question.options?.length) {
      schema = schema.refine(
        (value) => question.options?.includes(value as string) ?? false,
        { message: "Please select one of the available options." },
      );
    }

    if (question.type === "TEXT") {
      schema = schema.min(1, { message: "This field is required." });
    }

    if (!question.required) {
      schema = schema.optional().or(z.literal(""));
    }

    shape[question.id] = schema;
  }

  return z.object(shape);
}

export function buildDefaultResponses(questions: PublicScreenerQuestion[]) {
  return questions.reduce<Record<string, string>>((acc, question) => {
    acc[question.id] = "";
    return acc;
  }, {});
}

export function toResponseArray(
  questions: PublicScreenerQuestion[],
  values: Record<string, string>,
) {
  return questions
    .map((question) => {
      const raw = values[question.id];
      if (!raw) return null;

      let value: unknown = raw;
      if (question.type === "YES_NO") {
        value = raw === "Yes";
      }

      return { questionId: question.id, value };
    })
    .filter((entry): entry is { questionId: string; value: unknown } => !!entry);
}
