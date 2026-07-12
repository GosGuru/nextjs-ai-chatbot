import { Pool, neonConfig } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import ws from 'ws';
import { getMigrationDatabaseUrl } from './database-url';

config({
  path: '.env.local',
});

const MIGRATION_LOCK_ID = 2_026_071_200;
const MIGRATIONS_FOLDER = './lib/db/migrations';

function isNeonConnection(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname.endsWith('.neon.tech');
  } catch {
    return false;
  }
}

async function migrateNeonDatabase(databaseUrl: string) {
  neonConfig.webSocketConstructor = ws;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 20_000,
  });

  const client = await pool.connect();
  const db = drizzleNeon(client);
  let lockAcquired = false;

  try {
    console.log('Waiting for the database migration lock over Neon WebSockets...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    lockAcquired = true;

    console.log('Running database migrations...');
    await migrateNeon(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    if (lockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
        .catch((error) => {
          console.warn('Failed to release the migration lock', error);
        });
    }

    client.release();
    await pool.end();
  }
}

async function migrateStandardPostgres(databaseUrl: string) {
  const connection = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
  });

  const db = drizzlePostgres(connection);
  let lockAcquired = false;

  try {
    console.log('Waiting for the database migration lock over TCP...');
    await connection`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    lockAcquired = true;

    console.log('Running database migrations...');
    await migratePostgres(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    if (lockAcquired) {
      await connection`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    }

    await connection.end({ timeout: 5 });
  }
}

const runMigrate = async () => {
  const databaseUrl = getMigrationDatabaseUrl();
  const start = Date.now();

  if (isNeonConnection(databaseUrl)) {
    console.log('Detected Neon. Using the serverless WebSocket driver.');
    await migrateNeonDatabase(databaseUrl);
  } else {
    console.log('Using the standard PostgreSQL TCP driver.');
    await migrateStandardPostgres(databaseUrl);
  }

  console.log(`Database migrations completed in ${Date.now() - start}ms`);
};

runMigrate().catch((error) => {
  console.error('Database migration failed');
  console.error(error);
  process.exitCode = 1;
});
