import { z } from 'zod';

const optionSchema = z
  .object({
    type: z.string().optional(),
    text: z.string().min(1),
    rationale: z.string().optional(),
    intensity: z.string().optional(),
  })
  .passthrough();

export const sourceExampleSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    categoria: z.string().min(1),
    contexto_situacional: z.string().min(1),
    ultimo_mensaje_ella: z.string().min(1),
    analisis_subtexto_psicologico: z.string().min(1),
    opciones: z.array(optionSchema).min(1),
    platform: z.string().optional(),
    goal: z.string().optional(),
    strategy_tags: z.array(z.string()).optional(),
    investment_level: z.string().optional(),
    intensity: z.string().optional(),
    quality_score: z.number().min(0).max(1).optional(),
    locale: z
      .enum(['es-AR', 'es-UY', 'es-MX', 'es-CO', 'es-CL', 'es-419'])
      .optional(),
  })
  .strict();

const datasetSchema = z.array(sourceExampleSchema).min(1);

export type SourceExample = z.infer<typeof sourceExampleSchema>;

export function validateDataset(raw: string) {
  return datasetSchema.parse(JSON.parse(raw));
}
