import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isProduction = process.env.VERCEL_ENV === 'production';
const forceMigrations = process.env.RUN_DATABASE_MIGRATIONS === 'true';
const shouldMigrate = isProduction || forceMigrations;

if (shouldMigrate) {
  const migrationDatabaseUrl =
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL;

  if (!migrationDatabaseUrl) {
    throw new Error(
      'Production deployment requires DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL.',
    );
  }

  console.log('Preparing the production database...');
  run('pnpm', ['db:migrate']);
} else {
  console.log('Skipping database migrations for this non-production deployment.');
}

run('pnpm', ['build']);
