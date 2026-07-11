import { auth } from '@/app/(auth)/auth';
import { insertResponseFeedback } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { FeedbackPayload } from '@/lib/types';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const body: FeedbackPayload = await request.json();
    const { generationRunId, optionType, optionText, feedback, comment } = body;

    if (!generationRunId || !optionType || !optionText || !feedback) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const selected = feedback === 'selected';

    const feedbackRecord = await insertResponseFeedback({
      generationRunId,
      optionType,
      optionText,
      feedback,
      selected,
    });

    return Response.json(feedbackRecord, { status: 200 });
  } catch (error) {
    console.error('RAG Feedback API failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
