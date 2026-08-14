import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { performRAGSearch } from '@/lib/ai/rag-search';
import { ChatSDKError } from '@/lib/errors';

const searchSchema = z
  .object({
    queryText: z.string().trim().min(1).max(5000),
    locale: z
      .enum(['es-AR', 'es-UY', 'es-MX', 'es-CO', 'es-CL', 'es-419'])
      .default('es-419'),
    category: z.string().trim().max(100).optional(),
    goal: z.string().trim().max(100).optional(),
    platform: z.string().trim().max(100).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const payload = searchSchema.parse(await request.json());
    const result = await performRAGSearch(payload.queryText, {
      ...payload,
      limit: 6,
    });
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Manual RAG Search API failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
