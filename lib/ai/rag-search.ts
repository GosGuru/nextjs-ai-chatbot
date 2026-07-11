import {
  findSimilarExamples,
  getActiveRuleSet,
} from '../db/queries';
import type { ChatExample, AssistantRuleSet } from '../db/schema';
import { generateEmbedding } from './local-vectorizer';

export interface RAGSearchResult {
  examples: ChatExample[];
  ruleSet: AssistantRuleSet | null;
}

export async function performRAGSearch(
  queryText: string,
  limit = 6
): Promise<RAGSearchResult> {
  try {
    // 1. Generate local semantic embedding (768 dimensions)
    const embedding = await generateEmbedding(queryText);

    // 2. Perform DB similarity searches
    const examples = await findSimilarExamples(embedding, limit);
    const ruleSet = await getActiveRuleSet();

    return {
      examples,
      ruleSet,
    };
  } catch (error) {
    console.error('RAG Search Orchestrator failed:', error);
    return {
      examples: [],
      ruleSet: null,
    };
  }
}
