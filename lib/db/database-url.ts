export function getDatabaseUrl(): string;
export function getDatabaseUrl(options: { required: false }): string | undefined;
export function getDatabaseUrl(options?: { required?: boolean }) {
  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl && options?.required !== false) {
    throw new Error(
      'Database URL is not configured. Set POSTGRES_URL or DATABASE_URL.',
    );
  }

  return databaseUrl;
}

export function getMigrationDatabaseUrl() {
  const databaseUrl =
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Migration database URL is not configured. Set DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL.',
    );
  }

  return databaseUrl;
}
