function getHostname(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
}

function isSupabaseDirectConnection(databaseUrl: string) {
  const hostname = getHostname(databaseUrl);
  return hostname.startsWith('db.') && hostname.endsWith('.supabase.co');
}

function assertRuntimeDatabaseUrl(databaseUrl: string) {
  if (isSupabaseDirectConnection(databaseUrl)) {
    throw new Error(
      'POSTGRES_URL/DATABASE_URL uses the IPv6-only Supabase direct endpoint. Configure the Supabase Transaction pooler URL (port 6543) for runtime traffic.',
    );
  }
}

function assertMigrationDatabaseUrl(databaseUrl: string) {
  if (isSupabaseDirectConnection(databaseUrl)) {
    throw new Error(
      'The migration URL uses the IPv6-only Supabase direct endpoint. Configure MIGRATION_DATABASE_URL with the Supabase Session pooler URL (port 5432).',
    );
  }
}

export function getDatabaseUrl(): string;
export function getDatabaseUrl(options: { required: false }): string | undefined;
export function getDatabaseUrl(options?: { required?: boolean }) {
  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (options?.required === false) {
      return undefined;
    }

    throw new Error(
      'Database URL is not configured. Set POSTGRES_URL or DATABASE_URL.',
    );
  }

  assertRuntimeDatabaseUrl(databaseUrl);
  return databaseUrl;
}

export function getMigrationDatabaseUrl() {
  const databaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Migration database URL is not configured. Set MIGRATION_DATABASE_URL or a supported database URL.',
    );
  }

  assertMigrationDatabaseUrl(databaseUrl);
  return databaseUrl;
}
