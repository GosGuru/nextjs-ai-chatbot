import postgres from 'postgres';

const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error('POSTGRES_URL or MIGRATION_DATABASE_URL is required');
const hours = Math.min(168, Math.max(1, Number.parseInt(process.env.METRICS_WINDOW_HOURS || '24', 10)));
const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const rows = await sql`
    with feedback_by_run as (
      select
        generation_run_id,
        count(*) filter (where event = 'selected')::int as selections,
        count(*) filter (where event = 'copied')::int as copies,
        count(*) filter (where event = 'positive')::int as positive_ratings,
        count(*) filter (where event = 'negative')::int as negative_ratings
      from response_feedback
      group by generation_run_id
    )
    select
      runs.locale,
      runs.model,
      coalesce(runs.retrieval_scores->>'mode', 'unknown') as retrieval_mode,
      count(runs.id)::int as generations,
      round(avg(runs.latency_ms))::int as average_latency_ms,
      coalesce(sum(feedback.selections), 0)::int as selections,
      coalesce(sum(feedback.copies), 0)::int as copies,
      coalesce(sum(feedback.positive_ratings), 0)::int as positive_ratings,
      coalesce(sum(feedback.negative_ratings), 0)::int as negative_ratings
    from generation_runs runs
    left join feedback_by_run feedback on feedback.generation_run_id = runs.id
    where runs.created_at >= now() - (${hours}::text || ' hours')::interval
    group by runs.locale, runs.model, coalesce(runs.retrieval_scores->>'mode', 'unknown')
    order by runs.locale, runs.model, retrieval_mode
  `;
  console.log(JSON.stringify({ windowHours: hours, rows }, null, 2));
} finally {
  await sql.end();
}
