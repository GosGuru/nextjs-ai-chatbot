import { expect, test } from '../fixtures';
import {
  feedbackPayloadSchema,
  resolveFeedbackOptionText,
} from '@/lib/ai/feedback';

const generationRunId = '11111111-1111-4111-8111-111111111111';
const clientEventId = '22222222-2222-4222-8222-222222222222';

test.describe('RAG feedback security contract', () => {
  test('accepts the server-owned feedback contract', () => {
    const parsed = feedbackPayloadSchema.safeParse({
      generationRunId,
      optionType: 'directa_avance',
      event: 'selected',
      clientEventId,
    });

    expect(parsed.success).toBe(true);
  });

  test('rejects client-supplied option text and unknown events', () => {
    const spoofedText = feedbackPayloadSchema.safeParse({
      generationRunId,
      optionType: 'directa_avance',
      optionText: 'Client-controlled text',
      event: 'selected',
      clientEventId,
    });
    const unknownEvent = feedbackPayloadSchema.safeParse({
      generationRunId,
      optionType: 'directa_avance',
      event: 'regenerated',
      clientEventId,
    });

    expect(spoofedText.success).toBe(false);
    expect(unknownEvent.success).toBe(false);
  });

  test('derives option text from the persisted generation result', () => {
    const result = {
      options: [
        { type: 'directa_avance', text: 'Vamos por un café esta semana.' },
      ],
    };

    expect(resolveFeedbackOptionText(result, 'directa_avance')).toBe(
      'Vamos por un café esta semana.',
    );
    expect(resolveFeedbackOptionText(result, 'missing')).toBeNull();
  });
});
