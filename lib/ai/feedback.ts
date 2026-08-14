import { z } from 'zod';

export const feedbackPayloadSchema = z
  .object({
    generationRunId: z.string().uuid(),
    optionType: z.string().trim().min(1).max(64),
    event: z.enum(['positive', 'negative', 'copied', 'selected']),
    clientEventId: z.string().uuid(),
  })
  .strict();

export function resolveFeedbackOptionText(
  result: unknown,
  optionType: string,
): string | null {
  const parsed = z
    .object({
      options: z.array(
        z.object({
          type: z.string(),
          text: z.string().trim().min(1),
        }),
      ),
    })
    .safeParse(result);

  if (!parsed.success) {
    return null;
  }

  return (
    parsed.data.options.find((option) => option.type === optionType)?.text ??
    null
  );
}
