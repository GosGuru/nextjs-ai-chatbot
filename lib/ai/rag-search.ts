import type { AssistantRuleSet } from '../db/schema';
import {
  findSimilarExamples,
  getActiveRuleSet,
  type RetrievedExample,
} from '../db/queries';
import {
  DEFAULT_SEMANTIC_EMBEDDING_MODEL,
  generateSemanticEmbedding,
  SEMANTIC_EMBEDDING_VERSION,
} from './embeddings';
import { generateEmbedding } from './local-vectorizer';
import { normalizeLocale, type SupportedLocale } from './locales';

export interface RAGSearchOptions {
  limit?: number;
  locale?: string;
  category?: string;
  goal?: string;
  platform?: string;
}

export interface RAGSearchResult {
  examples: RetrievedExample[];
  ruleSet: AssistantRuleSet | null;
  retrieval: {
    mode: 'legacy' | 'semantic';
    locale: SupportedLocale;
    embeddingModel: string;
    embeddingVersion: number;
    matches: Array<{ id: string; locale: string; score: number }>;
  };
}

export async function performRAGSearch(
  queryText: string,
  options: RAGSearchOptions = {},
): Promise<RAGSearchResult> {
  const locale = normalizeLocale(options.locale);
  const semantic = process.env.RAG_EMBEDDING_MODE === 'semantic';
  const embedding = semantic
    ? await generateSemanticEmbedding(queryText)
    : await generateEmbedding(queryText);
  const embeddingModel = semantic
    ? process.env.RAG_EMBEDDING_MODEL || DEFAULT_SEMANTIC_EMBEDDING_MODEL
    : 'local-word-counter-v1';
  const embeddingVersion = semantic ? SEMANTIC_EMBEDDING_VERSION : 1;

  const [examples, ruleSet] = await Promise.all([
    findSimilarExamples({
      embedding,
      limit: options.limit ?? 6,
      locale,
      category: options.category,
      goal: options.goal,
      platform: options.platform,
      embeddingModel,
      embeddingVersion,
      semantic,
    }),
    getActiveRuleSet(locale),
  ]);

  return {
    examples,
    ruleSet,
    retrieval: {
      mode: semantic ? 'semantic' : 'legacy',
      locale,
      embeddingModel,
      embeddingVersion,
      matches: examples.map((example) => ({
        id: example.id,
        locale: example.locale,
        score: example.similarityScore,
      })),
    },
  };
}
