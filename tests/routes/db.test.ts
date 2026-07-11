import { expect, test } from '../fixtures';
import { chatExamples, assistantRuleSets, generationRuns, responseFeedback } from '@/lib/db/schema';
import Module from 'module';

// Pre-emptively mock server-only to avoid next/server-only error in playwright runtime
(Module as any)._cache[require.resolve('server-only')] = { exports: {} };

test.describe('Database RAG Schema Integration', () => {
  test('New RAG tables are defined in schema', () => {
    expect(chatExamples).toBeDefined();
    expect(assistantRuleSets).toBeDefined();
    expect(generationRuns).toBeDefined();
    expect(responseFeedback).toBeDefined();
  });

  test('New RAG query functions are defined', async () => {
    const dbQueries = await import('@/lib/db/queries');
    expect(dbQueries.findSimilarExamples).toBeDefined();
    expect(dbQueries.findSimilarRuleSets).toBeDefined();
    expect(dbQueries.insertGenerationRun).toBeDefined();
    expect(dbQueries.insertResponseFeedback).toBeDefined();
  });
});

