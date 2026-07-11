import { auth } from '@/app/(auth)/auth';
import { performRAGSearch } from '@/lib/ai/rag-search';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const { queryText } = await request.json();
    if (!queryText || typeof queryText !== 'string') {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const result = await performRAGSearch(queryText, 6);
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Manual RAG Search API failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
