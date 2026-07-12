export function getDatabaseUrl(options?: { required?: boolean }) {
  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl && options?.required !== false) {
    throw new Error(
      'Database URL is not configured. Set POSTGRES_URL or DATABASE_URL.',
    );
  }

  return databaseUrl;
}
