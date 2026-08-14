import { auth } from '@/app/(auth)/auth';
import { recordResponseFeedback } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { feedbackPayloadSchema } from '@/lib/ai/feedback';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const parsed = feedbackPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const feedbackRecord = await recordResponseFeedback({
      userId: session.user.id,
      ...parsed.data,
    });

    if (!feedbackRecord) {
      return new ChatSDKError('not_found:chat').toResponse();
    }

    return Response.json(feedbackRecord, { status: 200 });
  } catch (error) {
    console.error('RAG Feedback API failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
