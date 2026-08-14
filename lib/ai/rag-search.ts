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
import { resolveRagRollout } from './rag-rollout';

export interface RAGSearchOptions {
  limit?: number;
  locale?: string;
  category?: string;
  goal?: string;
  platform?: string;
  rolloutKey?: string;
}

type RetrievalMatch = { id: string; locale: string; score: number };

export interface RAGSearchResult {
  examples: RetrievedExample[];
  ruleSet: AssistantRuleSet | null;
  retrieval: {
    mode: 'legacy' | 'semantic';
    locale: SupportedLocale;
    embeddingModel: string;
    embeddingVersion: number;
    matches: RetrievalMatch[];
    rollout: { percentage: number; bucket: number };
    shadow?: {
      mode: 'semantic';
      matches: RetrievalMatch[];
      error?: string;
    };
  };
}

export async function performRAGSearch(
  queryText: string,
  options: RAGSearchOptions = {},
): Promise<RAGSearchResult> {
  const locale = normalizeLocale(options.locale);
  const rollout = resolveRagRollout(options.rolloutKey || queryText);

  const search = async (semantic: boolean) => {
    const embedding = semantic
      ? await generateSemanticEmbedding(queryText)
      : await generateEmbedding(queryText);
    const embeddingModel = semantic
      ? process.env.RAG_EMBEDDING_MODEL || DEFAULT_SEMANTIC_EMBEDDING_MODEL
      : 'local-word-counter-v1';
    const embeddingVersion = semantic ? SEMANTIC_EMBEDDING_VERSION : 1;
    const examples = await findSimilarExamples({
      embedding,
      limit: options.limit ?? 6,
      locale,
      category: options.category,
      goal: options.goal,
      platform: options.platform,
      embeddingModel,
      embeddingVersion,
      semantic,
    });

    return { examples, embeddingModel, embeddingVersion };
  };

  const [primary, ruleSet] = await Promise.all([
    search(rollout.semantic),
    getActiveRuleSet(locale),
  ]);
  const matches = primary.examples.map((example) => ({
    id: example.id,
    locale: example.locale,
    score: example.similarityScore,
  }));

  let shadow: RAGSearchResult['retrieval']['shadow'];
  if (rollout.shadow && !rollout.semantic) {
    try {
      const candidate = await search(true);
      shadow = {
        mode: 'semantic',
        matches: candidate.examples.map((example) => ({
          id: example.id,
          locale: example.locale,
          score: example.similarityScore,
        })),
      };
    } catch (error) {
      shadow = {
        mode: 'semantic',
        matches: [],
        error:
          error instanceof Error ? error.message : 'Shadow retrieval failed',
      };
    }
  }

  return {
    examples: primary.examples,
    ruleSet,
    retrieval: {
      mode: rollout.semantic ? 'semantic' : 'legacy',
      locale,
      embeddingModel: primary.embeddingModel,
      embeddingVersion: primary.embeddingVersion,
      matches,
      rollout: { percentage: rollout.percentage, bucket: rollout.bucket },
      shadow,
    },
  };
}
