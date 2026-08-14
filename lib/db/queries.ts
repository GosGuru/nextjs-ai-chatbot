import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  getTableColumns,
  inArray,
  lt,
  type SQL,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './database-url';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  chatExamples,
  assistantRuleSets,
  generationRuns,
  responseFeedback,
  type ChatExample,
  type AssistantRuleSet,
} from './schema';
import { localeFallbacks, type SupportedLocale } from '../ai/locales';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import type { AppUsage } from '../usage';
import { resolveFeedbackOptionText } from '../ai/feedback';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

type Database = ReturnType<typeof drizzle>;
let database: Database | undefined;

function getDb() {
  if (!database) {
    const client = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });

    database = drizzle(client);
  }

  return database;
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await getDb().select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await getDb()
      .insert(user)
      .values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await getDb().insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await getDb().insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await getDb().delete(vote).where(eq(vote.chatId, id));
    await getDb().delete(message).where(eq(message.chatId, id));
    await getDb().delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await getDb()
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      getDb()
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await getDb()
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await getDb()
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await getDb()
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await getDb().insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await getDb()
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await getDb()
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await getDb()
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await getDb()
      .insert(vote)
      .values({
        chatId,
        messageId,
        isUpvoted: type === 'up',
      });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await getDb().select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await getDb()
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await getDb()
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await getDb()
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await getDb()
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await getDb()
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await getDb().insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await getDb()
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await getDb().select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await getDb()
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await getDb()
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await getDb()
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await getDb()
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await getDb()
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn('Failed to update lastContext for chat', chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await getDb()
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await getDb()
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await getDb()
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

// RAG Query Functions
export interface SimilarExamplesQuery {
  embedding: number[];
  limit?: number;
  locale: SupportedLocale;
  category?: string;
  goal?: string;
  platform?: string;
  semantic: boolean;
  embeddingModel: string;
  embeddingVersion: number;
}

export type RetrievedExample = ChatExample & {
  similarityScore: number;
};

export async function findSimilarExamples({
  embedding,
  limit = 6,
  locale,
  category,
  goal,
  platform,
  semantic,
  embeddingModel,
  embeddingVersion,
}: SimilarExamplesQuery): Promise<Array<RetrievedExample>> {
  try {
    if (embedding.length !== 768) {
      throw new Error('Embedding version mismatch: expected 768 dimensions');
    }

    const vectorStr = JSON.stringify(embedding);
    const fallbacks = localeFallbacks(locale);
    const vectorColumn = semantic
      ? chatExamples.embeddingV2
      : chatExamples.embedding;
    const baseConditions = [
      eq(chatExamples.active, true),
      inArray(chatExamples.locale, fallbacks),
    ];

    if (semantic) {
      baseConditions.push(eq(chatExamples.embeddingVersion, embeddingVersion));
      baseConditions.push(eq(chatExamples.embeddingModel, embeddingModel));
      baseConditions.push(sql`${chatExamples.embeddingV2} is not null`);
    }

    const query = async (useMetadata: boolean) => {
      const conditions = [...baseConditions];
      if (useMetadata && category && category !== 'auto') {
        conditions.push(eq(chatExamples.category, category));
      }
      if (useMetadata && goal) {
        conditions.push(eq(chatExamples.goal, goal));
      }
      if (useMetadata && platform) {
        conditions.push(eq(chatExamples.platform, platform));
      }

      return getDb()
        .select({
          ...getTableColumns(chatExamples),
          similarityScore: sql<number>`(1 - (${vectorColumn} <=> ${vectorStr}::vector))::float`,
        })
        .from(chatExamples)
        .where(and(...conditions))
        .orderBy(
          sql`array_position(${fallbacks}::text[], ${chatExamples.locale})`,
          sql`${vectorColumn} <=> ${vectorStr}::vector`,
          desc(chatExamples.qualityScore),
        )
        .limit(limit);
    };

    const filtered = await query(true);
    return filtered.length > 0 ? filtered : query(false);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to find similar examples',
    );
  }
}

export async function getActiveRuleSet(
  locale: SupportedLocale = 'es-419',
): Promise<AssistantRuleSet | null> {
  try {
    const fallbacks = localeFallbacks(locale);
    const results = await getDb()
      .select()
      .from(assistantRuleSets)
      .where(
        and(
          eq(assistantRuleSets.active, true),
          inArray(assistantRuleSets.locale, fallbacks),
        ),
      )
      .orderBy(
        sql`array_position(${fallbacks}::text[], ${assistantRuleSets.locale})`,
        desc(assistantRuleSets.version),
      )
      .limit(1);
    return results[0] || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get active rule set',
    );
  }
}

export async function findSimilarRuleSets(
  promptEmbedding: number[],
  limit = 2,
): Promise<Array<AssistantRuleSet>> {
  try {
    const active = await getActiveRuleSet('es-419');
    return active ? [active] : [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to find similar rule sets',
    );
  }
}

export async function insertGenerationRun(data: {
  userId?: string | null;
  chatId?: string | null;
  inputSnapshot: any;
  controls: any;
  detectedCategory: string;
  retrievedExampleIds: string[] | null;
  retrievalScores: any;
  ruleSetId?: string | null;
  model: string;
  result: any;
  latencyMs: number;
  locale?: string;
}) {
  try {
    const [run] = await getDb()
      .insert(generationRuns)
      .values({
        ...data,
        userId: data.userId || null,
        chatId: data.chatId || null,
        ruleSetId: data.ruleSetId || null,
      })
      .returning();
    return run;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to insert generation run',
    );
  }
}

export async function recordResponseFeedback(data: {
  userId: string;
  generationRunId: string;
  optionType: string;
  event: 'positive' | 'negative' | 'copied' | 'selected';
  clientEventId: string;
}) {
  try {
    return await getDb().transaction(async (tx) => {
      const [run] = await tx
        .select({ result: generationRuns.result })
        .from(generationRuns)
        .where(
          and(
            eq(generationRuns.id, data.generationRunId),
            eq(generationRuns.userId, data.userId),
          ),
        )
        .limit(1);

      if (!run) {
        return null;
      }

      const optionText = resolveFeedbackOptionText(run.result, data.optionType);

      if (!optionText) {
        throw new ChatSDKError(
          'bad_request:database',
          'The selected option does not exist in this generation run.',
        );
      }

      const [created] = await tx
        .insert(responseFeedback)
        .values({
          generationRunId: data.generationRunId,
          clientEventId: data.clientEventId,
          optionType: data.optionType,
          optionText,
          feedback: data.event,
          selected: data.event === 'selected',
        })
        .onConflictDoNothing({ target: responseFeedback.clientEventId })
        .returning();

      if (created) {
        return created;
      }

      return {
        duplicate: true as const,
        clientEventId: data.clientEventId,
      };
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to insert response feedback',
    );
  }
}
