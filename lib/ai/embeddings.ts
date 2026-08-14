import OpenAI from 'openai';

export const SEMANTIC_EMBEDDING_DIMENSIONS = 768;
export const SEMANTIC_EMBEDDING_VERSION = 2;
export const DEFAULT_SEMANTIC_EMBEDDING_MODEL = 'text-embedding-3-small';

export function validateSemanticEmbedding(vector: number[]): number[] {
  if (
    vector.length !== SEMANTIC_EMBEDDING_DIMENSIONS ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Invalid semantic embedding: expected ${SEMANTIC_EMBEDDING_DIMENSIONS} finite dimensions`,
    );
  }

  return vector;
}

export async function generateSemanticEmbeddings(
  inputs: string[],
): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for semantic embeddings');
  }

  const model =
    process.env.RAG_EMBEDDING_MODEL || DEFAULT_SEMANTIC_EMBEDDING_MODEL;
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model,
    input: inputs,
    dimensions: SEMANTIC_EMBEDDING_DIMENSIONS,
    encoding_format: 'float',
  });
  const vectors = response.data
    .sort((left, right) => left.index - right.index)
    .map((item) => validateSemanticEmbedding(item.embedding));

  if (vectors.length !== inputs.length) {
    throw new Error('Embedding provider returned an unexpected vector count');
  }

  return vectors;
}

export async function generateSemanticEmbedding(input: string) {
  const [embedding] = await generateSemanticEmbeddings([input]);
  return embedding;
}
