import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from './database-url';

config({
  path: '.env.local',
});

const MIGRATION_LOCK_ID = 2_026_071_200;

const runMigrate = async () => {
  const databaseUrl = getDatabaseUrl();

  const connection = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
  });

  const db = drizzle(connection);
  const start = Date.now();
  let lockAcquired = false;

  try {
    console.log('Waiting for the database migration lock...');
    await connection`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    lockAcquired = true;

    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './lib/db/migrations' });

    console.log(`Database migrations completed in ${Date.now() - start}ms`);
  } finally {
    if (lockAcquired) {
      await connection`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    }

    await connection.end({ timeout: 5 });
  }
};

runMigrate().catch((error) => {
  console.error('Database migration failed');
  console.error(error);
  process.exitCode = 1;
});
