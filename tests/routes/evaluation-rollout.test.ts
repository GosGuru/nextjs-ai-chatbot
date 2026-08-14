import { expect, test } from '@playwright/test';
import { resolveRagRollout } from '@/lib/ai/rag-rollout';
import {
  evaluateDmQuality,
  type BlindMapping,
  type BlindRating,
  type EvaluationScenario,
  type SystemOutput,
  validateScenarioSet,
} from '@/lib/evaluation/dm-quality';
import { supportedLocales } from '@/lib/ai/locales';

const response = {
  analysis: {
    category: 'apertura',
    conversationalReading: 'Neutral opening.',
    observedSignals: ['reply'],
    apparentInvestment: 'medium',
    principalRisk: 'Over-escalation.',
    recommendedStrategy: 'Keep it light.',
    confidence: 0.9,
  },
  options: [
    {
      type: 'calibrada_espejo',
      text: 'Hola, ¿cómo va?',
      rationale: 'Matches the current investment.',
      intensity: 'medium',
    },
  ],
};

function buildPassingEvaluation() {
  const scenarios: EvaluationScenario[] = [];
  const baseline: SystemOutput[] = [];
  const candidate: SystemOutput[] = [];
  const mappings: BlindMapping[] = [];
  const ratings: BlindRating[] = [];
  supportedLocales.forEach((locale, localeIndex) => {
    for (let index = 0; index < 20; index += 1) {
      const scenarioId = `${locale}-${index}`;
      const relevantId = `${localeIndex.toString().padStart(8, '0')}-0000-4000-8000-${index.toString().padStart(12, '0')}`;
      scenarios.push({
        id: scenarioId,
        locale,
        input: 'Conversation',
        expectedRelevantExampleIds: [relevantId],
      });
      baseline.push({ scenarioId, response, retrievedExampleIds: [] });
      candidate.push({
        scenarioId,
        response,
        retrievedExampleIds: [relevantId],
      });
      mappings.push({ scenarioId, variantA: 'candidate' });
      ratings.push({
        scenarioId,
        unsafeVariants: [],
        regionalAdequate: { A: true, B: true },
        preference: index < 16 ? 'A' : 'B',
      });
    }
  });
  return { scenarios, baseline, candidate, mappings, ratings };
}

test('requires exactly 20 private scenarios per supported locale', () => {
  const data = buildPassingEvaluation();
  expect(validateScenarioSet(data.scenarios)).toHaveLength(120);
  expect(() => validateScenarioSet(data.scenarios.slice(1))).toThrow();
});

test('enforces every quality gate', () => {
  const report = evaluateDmQuality(buildPassingEvaluation());
  expect(report.passed).toBe(true);
  expect(report.metrics).toMatchObject({
    unsafeCount: 0,
    regionalAdequacy: 1,
    retrievalRelevance: 1,
    validStructure: 1,
    humanImprovement: 0.6,
  });
});

test('keeps staged rollout bucketing deterministic and bounded', () => {
  const previousMode = process.env.RAG_EMBEDDING_MODE;
  const previousPercentage = process.env.RAG_SEMANTIC_ROLLOUT_PERCENT;
  process.env.RAG_EMBEDDING_MODE = 'semantic';
  process.env.RAG_SEMANTIC_ROLLOUT_PERCENT = '10';
  const first = resolveRagRollout('user:chat');
  const second = resolveRagRollout('user:chat');
  expect(first).toEqual(second);
  expect(first.semantic).toBe(first.bucket < 10);
  if (previousMode === undefined) delete process.env.RAG_EMBEDDING_MODE;
  else process.env.RAG_EMBEDDING_MODE = previousMode;
  if (previousPercentage === undefined)
    delete process.env.RAG_SEMANTIC_ROLLOUT_PERCENT;
  else process.env.RAG_SEMANTIC_ROLLOUT_PERCENT = previousPercentage;
});
