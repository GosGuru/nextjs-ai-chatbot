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
  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Production deployment requires POSTGRES_URL or DATABASE_URL.',
    );
  }

  console.log('Preparing the production database...');
  run('pnpm', ['db:migrate']);
} else {
  console.log('Skipping database migrations for this non-production deployment.');
}

run('pnpm', ['build']);
