import { createHash } from 'node:crypto';
import postgres from 'postgres';

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error('A migration/non-pooling database URL is required.');
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const exampleHashes = await sql`
    select source_hash
    from chat_examples
    order by source_hash
  `;
  const [rules] = await sql`
    select count(*)::integer as count
    from assistant_rule_sets
  `;
  const [users] = await sql`
    select count(*)::integer as count
    from "User"
  `;
  const examples = {
    count: exampleHashes.length,
    checksum: createHash('sha256')
      .update(exampleHashes.map(({ source_hash }) => source_hash).join(''))
      .digest('hex'),
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    tables: {
      chat_examples: examples,
      assistant_rule_sets: rules,
      User: users,
    },
  };
  const canonical = JSON.stringify(manifest.tables);
  manifest.manifestChecksum = createHash('sha256')
    .update(canonical)
    .digest('hex');

  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await sql.end();
}
