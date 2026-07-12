import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/lib/db/database-url';

export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Cache-Control': 'no-store',
};

export async function GET() {
  const databaseUrl = getDatabaseUrl({ required: false });

  if (!databaseUrl) {
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'chatbot-dms',
        checks: {
          database: 'not_configured',
          schema: 'unknown',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: responseHeaders },
    );
  }

  const connection = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
  });

  try {
    const [result] = await connection<
      Array<{
        userTable: string | null;
        vectorExtension: string | null;
      }>
    >`
      SELECT
        to_regclass('public."User"')::text AS "userTable",
        (SELECT extname FROM pg_extension WHERE extname = 'vector') AS "vectorExtension"
    `;

    const schemaReady = Boolean(result?.userTable && result?.vectorExtension);

    return NextResponse.json(
      {
        status: schemaReady ? 'ok' : 'degraded',
        service: 'chatbot-dms',
        checks: {
          database: 'reachable',
          schema: schemaReady ? 'ready' : 'missing_migrations',
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: schemaReady ? 200 : 503,
        headers: responseHeaders,
      },
    );
  } catch (error) {
    console.error('Health check database failure', error);

    return NextResponse.json(
      {
        status: 'degraded',
        service: 'chatbot-dms',
        checks: {
          database: 'unreachable',
          schema: 'unknown',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: responseHeaders },
    );
  } finally {
    await connection.end({ timeout: 5 });
  }
}
