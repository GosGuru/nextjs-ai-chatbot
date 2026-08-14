const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.',
  );
}

const tables = [
  'User',
  'Chat',
  'Message',
  'Message_v2',
  'Vote',
  'Vote_v2',
  'Document',
  'Suggestion',
  'Stream',
  'chat_examples',
  'assistant_rule_sets',
  'generation_runs',
  'response_feedback',
];

const exposed = [];

for (const table of tables) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
    },
  );

  if (response.ok) {
    exposed.push(table);
  }
}

if (exposed.length > 0) {
  console.error(`Public Data API exposure detected: ${exposed.join(', ')}`);
  process.exit(1);
}

console.log('Public Data API audit passed: app tables reject anonymous reads.');
