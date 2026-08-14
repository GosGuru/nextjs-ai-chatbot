export interface RagRolloutDecision {
  semantic: boolean;
  shadow: boolean;
  percentage: number;
  bucket: number;
}

function stableBucket(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function resolveRagRollout(key: string): RagRolloutDecision {
  const configured = Number.parseInt(
    process.env.RAG_SEMANTIC_ROLLOUT_PERCENT || '0',
    10,
  );
  const percentage = Number.isFinite(configured)
    ? Math.min(100, Math.max(0, configured))
    : 0;
  const bucket = stableBucket(key);

  return {
    semantic:
      process.env.RAG_EMBEDDING_MODE === 'semantic' && bucket < percentage,
    shadow: process.env.RAG_SHADOW_EVALUATION === 'true',
    percentage,
    bucket,
  };
}
