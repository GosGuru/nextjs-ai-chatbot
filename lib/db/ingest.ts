import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  DEFAULT_SEMANTIC_EMBEDDING_MODEL,
  generateSemanticEmbeddings,
  SEMANTIC_EMBEDDING_VERSION,
} from '../ai/embeddings';
import { reviewedLocaleRuleSets } from '../ai/locale-rules';
import { normalizeLocale, supportedLocales } from '../ai/locales';
import { getDatabaseUrl } from './database-url';
import { validateDataset, type SourceExample } from './dataset-import';
import { assistantRuleSets, chatExamples, datasetVersions } from './schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ImportOptions {
  datasetPath: string;
  version: string;
  locale: string;
  dryRun: boolean;
}

export function parseImportArgs(args: string[]): ImportOptions {
  const valueAfter = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    datasetPath: path.resolve(
      process.cwd(),
      valueAfter('--dataset') || 'Datasetfinal.json',
    ),
    version:
      valueAfter('--version') ||
      `dataset-${new Date().toISOString().slice(0, 10)}`,
    locale: valueAfter('--locale') || 'es-AR',
    dryRun: args.includes('--dry-run'),
  };
}

function inferMetadata(item: SourceExample) {
  const text =
    `${item.contexto_situacional} ${item.ultimo_mensaje_ella}`.toLowerCase();
  const platform =
    item.platform ||
    (text.includes('instagram')
      ? 'Instagram'
      : text.includes('whatsapp')
        ? 'WhatsApp'
        : text.includes('bumble')
          ? 'Bumble'
          : text.includes('tinder')
            ? 'Tinder'
            : 'Unknown');
  const goal =
    item.goal ||
    (item.categoria.toLowerCase().includes('concre')
      ? 'pactar_cita'
      : 'calibrar_charla');
  const investmentLevel =
    item.investment_level ||
    (item.ultimo_mensaje_ella.length > 80
      ? 'high'
      : item.ultimo_mensaje_ella.length > 25
        ? 'medium'
        : 'low');
  const intensity = item.intensity || 'medium';
  const strategyTags = item.strategy_tags?.length
    ? item.strategy_tags
    : [item.categoria.toLowerCase().replaceAll('-', '_'), goal];
  const qualityScore =
    item.quality_score ??
    Math.min(
      1,
      0.45 +
        (item.opciones.length >= 3 ? 0.2 : 0.1) +
        (item.analisis_subtexto_psicologico.length >= 80 ? 0.15 : 0.05) +
        (item.contexto_situacional.length >= 80 ? 0.15 : 0.05),
    );

  return {
    platform,
    goal,
    investmentLevel,
    intensity,
    strategyTags,
    qualityScore,
  };
}

async function run() {
  const options = parseImportArgs(process.argv.slice(2));
  if (!fs.existsSync(options.datasetPath)) {
    throw new Error(`Dataset file not found: ${options.datasetPath}`);
  }

  const raw = fs.readFileSync(options.datasetPath, 'utf8');
  const items = validateDataset(raw);
  const checksum = crypto.createHash('sha256').update(raw).digest('hex');
  const defaultLocale = normalizeLocale(options.locale);
  if (!supportedLocales.includes(options.locale as typeof defaultLocale)) {
    throw new Error(`Unsupported locale: ${options.locale}`);
  }

  console.log(
    JSON.stringify(
      {
        valid: true,
        count: items.length,
        checksum,
        version: options.version,
        defaultLocale,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  );
  if (options.dryRun) return;

  const searchableTexts = items.map(
    (item) =>
      `Categoría: ${item.categoria}. Contexto: ${item.contexto_situacional}. Último mensaje recibido: ${item.ultimo_mensaje_ella}.`,
  );
  const embeddings: number[][] = [];
  for (let offset = 0; offset < searchableTexts.length; offset += 50) {
    embeddings.push(
      ...(await generateSemanticEmbeddings(
        searchableTexts.slice(offset, offset + 50),
      )),
    );
  }

  const embeddingModel =
    process.env.RAG_EMBEDDING_MODEL || DEFAULT_SEMANTIC_EMBEDDING_MODEL;
  const rows = items.map((item, index) => {
    const metadata = inferMetadata(item);
    const locale = normalizeLocale(item.locale || defaultLocale);
    const sourceHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          locale,
          category: item.categoria,
          context: item.contexto_situacional,
          lastMessage: item.ultimo_mensaje_ella,
          options: item.opciones,
        }),
      )
      .digest('hex');

    return {
      category: item.categoria.toLowerCase().replaceAll('-', '_'),
      situationalContext: item.contexto_situacional,
      lastMessage: item.ultimo_mensaje_ella,
      psychologicalAnalysis: item.analisis_subtexto_psicologico,
      options: item.opciones,
      searchableText: searchableTexts[index],
      platform: metadata.platform,
      goal: metadata.goal,
      strategyTags: metadata.strategyTags,
      investmentLevel: metadata.investmentLevel,
      intensity: metadata.intensity,
      qualityScore: metadata.qualityScore.toFixed(2),
      embedding: embeddings[index],
      embeddingV2: embeddings[index],
      embeddingModel,
      embeddingVersion: SEMANTIC_EMBEDDING_VERSION,
      locale,
      datasetVersion: options.version,
      sourceMetadata: { sourceId: item.id ?? null },
      sourceHash,
      active: true,
      updatedAt: new Date(),
    };
  });

  const client = postgres(getDatabaseUrl(), { max: 1, prepare: false });
  const db = drizzle(client);
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(chatExamples)
        .values(rows)
        .onConflictDoUpdate({
          target: chatExamples.sourceHash,
          set: {
            active: true,
            category: sql`excluded.category`,
            situationalContext: sql`excluded.situational_context`,
            lastMessage: sql`excluded.last_message`,
            psychologicalAnalysis: sql`excluded.psychological_analysis`,
            options: sql`excluded.options`,
            searchableText: sql`excluded.searchable_text`,
            platform: sql`excluded.platform`,
            goal: sql`excluded.goal`,
            strategyTags: sql`excluded.strategy_tags`,
            investmentLevel: sql`excluded.investment_level`,
            intensity: sql`excluded.intensity`,
            qualityScore: sql`excluded.quality_score`,
            embedding: sql`excluded.embedding`,
            embeddingV2: sql`excluded.embedding_v2`,
            embeddingModel: sql`excluded.embedding_model`,
            embeddingVersion: sql`excluded.embedding_version`,
            locale: sql`excluded.locale`,
            datasetVersion: sql`excluded.dataset_version`,
            sourceMetadata: sql`excluded.source_metadata`,
            updatedAt: new Date(),
          },
        });

      for (const ruleSet of reviewedLocaleRuleSets) {
        await tx
          .update(assistantRuleSets)
          .set({ active: false })
          .where(eq(assistantRuleSets.locale, ruleSet.locale));
        await tx
          .insert(assistantRuleSets)
          .values(ruleSet)
          .onConflictDoUpdate({
            target: [
              assistantRuleSets.locale,
              assistantRuleSets.name,
              assistantRuleSets.version,
            ],
            set: {
              systemPrompt: ruleSet.systemPrompt,
              rules: ruleSet.rules,
              active: true,
            },
          });
      }

      await tx
        .insert(datasetVersions)
        .values({
          version: options.version,
          checksum,
          sourceCount: rows.length,
          locales: [...new Set(rows.map((row) => row.locale))],
          embeddingModel,
          embeddingVersion: SEMANTIC_EMBEDDING_VERSION,
        })
        .onConflictDoUpdate({
          target: datasetVersions.version,
          set: {
            checksum,
            sourceCount: rows.length,
            locales: [...new Set(rows.map((row) => row.locale))],
          },
        });
    });
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
