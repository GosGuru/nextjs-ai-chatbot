import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  generateText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider, openaiProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { unstable_cache as cache } from 'next/cache';
import { fetchModels } from 'tokenlens/fetch';
import { getUsage } from 'tokenlens/helpers';
import type { ModelCatalog } from 'tokenlens/core';
import type { AppUsage } from '@/lib/usage';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        'TokenLens: catalog fetch failed, using default catalog',
        err,
      );
      return undefined; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ['tokenlens-catalog'],
  { revalidate: 24 * 60 * 60 }, // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

async function extractConversationFromImages(files: Array<{ url: string; mediaType: string }>) {
  const visionPrompt = `
Eres un experto en transcripción de chats. Analizá estas capturas de pantalla de una conversación.
Extraé cronológicamente todos los mensajes que sean visibles y determiná:
1. El último mensaje recibido de la otra persona (la chica/destinataria).
2. El contexto situacional actual de la charla.

Tu respuesta debe ser ESTRICTAMENTE un JSON con esta estructura (sin formato markdown adicional fuera del objeto JSON):
{
  "transcription": "Completa la transcripción con 'Él: ...' y 'Ella: ...'",
  "lastMessage": "El último mensaje de ella",
  "contextSummary": "Resumen situacional"
}
`;

  try {
    const response = await generateText({
      model: openaiProvider('gpt-4o-mini') as any,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            ...files.map((file) => ({
              type: 'image' as const,
              image: new URL(file.url),
            })),
          ],
        },
      ],
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) {
      text = text.substring(7, text.length - 3).trim();
    } else if (text.startsWith('```')) {
      text = text.substring(3, text.length - 3).trim();
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Vision extraction failed:', error);
    return {
      transcription: '',
      lastMessage: '',
      contextSummary: '',
    };
  }
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      controls,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      controls?: any;
    } = requestBody;

    const startTime = Date.now();

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    let extractedTranscription = '';
    let extractedLastMessage = '';
    let extractedContext = '';
    let customSystemPrompt: string | undefined;
    let examples: any[] = [];
    let ruleSet: any = null;

    if (controls) {
      const imageFiles = message.parts.filter((p) => p.type === 'file') as Array<{
        url: string;
        mediaType: string;
      }>;
      if (imageFiles.length > 0) {
        const ext = await extractConversationFromImages(imageFiles);
        extractedTranscription = ext.transcription;
        extractedLastMessage = ext.lastMessage;
        extractedContext = ext.contextSummary;
      }

      const queryText = `Categoría: ${controls.category}. Contexto: ${
        extractedContext ||
        message.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as any).text)
          .join(' ')
      }. Último mensaje recibido: ${
        extractedLastMessage ||
        message.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as any).text)
          .join(' ')
      }.`;

      const { performRAGSearch } = await import('@/lib/ai/rag-search');
      const RAGResult = await performRAGSearch(queryText, 6);
      examples = RAGResult.examples;
      ruleSet = RAGResult.ruleSet;

      const { buildRAGSystemPrompt } = await import('@/lib/ai/prompts');
      customSystemPrompt = buildRAGSystemPrompt({
        controls,
        examples,
        ruleSet,
      });
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: customSystemPrompt || systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          onFinish: async ({ usage, text }) => {
            const latencyMs = Date.now() - startTime;
            if (controls) {
              try {
                let detectedCategory = controls.category;
                let parsedResult: any = {};
                try {
                  let cleanText = text.trim();
                  if (cleanText.startsWith('```json')) {
                    cleanText = cleanText.substring(7, cleanText.length - 3).trim();
                  } else if (cleanText.startsWith('```')) {
                    cleanText = cleanText.substring(3, cleanText.length - 3).trim();
                  }
                  parsedResult = JSON.parse(cleanText);
                  if (parsedResult.analysis?.category) {
                    detectedCategory = parsedResult.analysis.category;
                  }
                } catch (e) {
                  console.warn('Failed parsing streamed JSON response:', e);
                }

                const { insertGenerationRun } = await import('@/lib/db/queries');
                const run = await insertGenerationRun({
                  userId: session.user.id,
                  chatId: id,
                  inputSnapshot: {
                    prompt: message.parts
                      .filter((p) => p.type === 'text')
                      .map((p) => (p as any).text)
                      .join(' '),
                    transcription: extractedTranscription,
                    lastMessage: extractedLastMessage,
                    context: extractedContext,
                  },
                  controls,
                  detectedCategory,
                  retrievedExampleIds: examples.map((ex) => ex.id),
                  retrievalScores: {},
                  ruleSetId: ruleSet ? ruleSet.id : null,
                  model: selectedChatModel === 'chat-model' ? 'deepseek-chat' : selectedChatModel,
                  result: parsedResult,
                  latencyMs,
                });

                dataStream.write({ type: 'data-generation-run-id', data: run.id } as any);
              } catch (err) {
                console.error('Failed to log generation run:', err);
              }
            }

            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({ type: 'data-usage', data: finalMergedUsage });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({ type: 'data-usage', data: finalMergedUsage });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            } catch (err) {
              console.warn('TokenLens enrichment failed', err);
              finalMergedUsage = usage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn('Unable to persist last usage for chat', id, err);
          }
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        'AI Gateway requires a valid credit card on file to service requests',
      )
    ) {
      return new ChatSDKError('bad_request:activate_gateway').toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
