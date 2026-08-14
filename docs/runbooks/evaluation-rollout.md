# Private evaluation and staged rollout

Evaluation scenarios, model outputs, blind mappings, ratings, and reports are private operational data. Keep all five files outside the repository.

## Acceptance set

Prepare exactly 120 scenarios: 20 each for `es-AR`, `es-UY`, `es-MX`, `es-CO`, `es-CL`, and `es-419`. Each scenario contains a stable ID, locale, input, and the relevant example IDs used as retrieval ground truth.

Generate baseline and candidate output files with the same scenario IDs. Create the blinded review bundle and store the mapping separately from reviewers:

```powershell
pnpm eval:blind-bundle -- --scenarios C:\private\scenarios.json --baseline C:\private\baseline.json --candidate C:\private\candidate.json --salt '<private random salt>' --output C:\private\blind.json --mapping C:\private\mapping.json
```

Reviewers record unsafe variants, regional adequacy for A and B, and a preference. Evaluate all gates:

```powershell
pnpm eval:dm-quality -- --scenarios C:\private\scenarios.json --baseline C:\private\baseline.json --candidate C:\private\candidate.json --mapping C:\private\mapping.json --ratings C:\private\ratings.json
```

The command fails unless there are zero unsafe candidate responses, at least 90% regional adequacy, 80% retrieval relevance, 99% valid response structure, and a 15-point human preference improvement.

## Rollout

1. **Shadow:** `RAG_EMBEDDING_MODE=legacy`, `RAG_SHADOW_EVALUATION=true`, `RAG_SEMANTIC_ROLLOUT_PERCENT=0`.
2. **10%:** `RAG_EMBEDDING_MODE=semantic`, shadow off, percentage `10`.
3. **50%:** percentage `50` only after the 10% cohort meets the same safety and structure gates without latency/error regression.
4. **100%:** percentage `100` only after the 50% cohort remains healthy for the agreed observation window.

User-and-chat bucketing is deterministic. A rollback changes the percentage to `0`; it never reopens Supabase Data API permissions.

## Monitoring

Run the read-only aggregate against the server PostgreSQL connection:

```powershell
$env:METRICS_WINDOW_HOURS = '24'
pnpm rag:metrics
```

Monitor generation errors externally plus latency, selection, copy, positive/negative feedback, model, retrieval mode, and locale from the report. Stop promotion on any unsafe response, structure regression, material error increase, or unacceptable latency increase.
