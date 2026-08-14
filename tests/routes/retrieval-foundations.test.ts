import { expect, test } from '@playwright/test';
import {
  SEMANTIC_EMBEDDING_DIMENSIONS,
  validateSemanticEmbedding,
} from '@/lib/ai/embeddings';
import { localeFallbacks, normalizeLocale } from '@/lib/ai/locales';
import { buildRAGSystemPrompt } from '@/lib/ai/prompts';
import { validateDataset } from '@/lib/db/dataset-import';

test('validates semantic embedding dimensions', () => {
  const valid = Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, () => 0);
  expect(validateSemanticEmbedding(valid)).toHaveLength(768);
  expect(() => validateSemanticEmbedding([0, 1])).toThrow(/768/);
  expect(() =>
    validateSemanticEmbedding([...valid.slice(0, -1), Number.NaN]),
  ).toThrow(/finite/);
});

test('uses an explicit regional fallback order', () => {
  expect(localeFallbacks('es-MX')).toEqual(['es-MX', 'es-419', 'es-AR']);
  expect(localeFallbacks('es-419')).toEqual(['es-419', 'es-AR']);
  expect(normalizeLocale('unsupported')).toBe('es-419');
});

test('dating prompt requires regional voice and consent-safe behavior', () => {
  const prompt = buildRAGSystemPrompt({
    controls: {
      locale: 'es-MX',
      platform: 'Instagram',
      category: 'apertura',
      objective: 'calibrar_charla',
      responseType: 'auto',
      intensity: 'media',
      extension: 'breve',
    },
    examples: [],
    ruleSet: null,
  });

  expect(prompt).toContain('Locale: es-MX');
  expect(prompt).toContain('rechazo explícito o implícito');
  expect(prompt).toContain('No insultes, humilles, amenaces, engañes');
  expect(prompt).not.toContain('ESPAÑOL RIOPLATENSE');
});

test('dataset importer validates before writes and supports dry-run', () => {
  const raw = JSON.stringify([
    {
      id: 1,
      categoria: 'apertura',
      contexto_situacional: 'A new match starts a short conversation.',
      ultimo_mensaje_ella: 'Hola, ¿cómo estás?',
      analisis_subtexto_psicologico:
        'There is neutral openness without evidence of stronger interest.',
      opciones: [{ text: 'Bien, ¿y vos?' }],
    },
  ]);

  expect(validateDataset(raw)).toHaveLength(1);
  expect(() => validateDataset('{}')).toThrow();
});
