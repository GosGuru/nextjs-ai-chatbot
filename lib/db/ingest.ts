import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { chatExamples, assistantRuleSets } from './schema';
import { generateEmbedding } from '../ai/local-vectorizer';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('CRITICAL: POSTGRES_URL environment variable is missing.');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function run() {
  console.log('Starting dataset ingestion...');

  const datasetPath = path.resolve(process.cwd(), 'Datasetfinal.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`CRITICAL: Dataset file not found at ${datasetPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(datasetPath, 'utf8');
  const items = JSON.parse(rawData);

  console.log(`Loaded ${items.length} examples from dataset.`);

  // Seeding Rioplatense coach active rules
  const activeRuleSet = {
    name: 'Rioplatense Default Rules',
    version: 1,
    systemPrompt: `
Reglas específicas para sonar natural en Buenos Aires / Río de la Plata:
- Usar siempre el voseo (vos sos, vos tenés, vos estás).
- Nunca usar "tú", "eres", "contigo" ni terminaciones en "ais"/"eis".
- Evitar sobrecargar de modismos si no encajan con la intensidad elegida.
- Usar humor y desapego calibrados según el interés mostrado.
`,
    rules: [
      'Evitar explicaciones defensivas.',
      'Romper el patrón con humor absurdo.',
      'Asumir un marco de alta familiaridad.',
      'Calibrar la respuesta al nivel de inversión detectado.',
    ],
    active: true,
  };

  try {
    console.log('Seeding initial rule set...');
    // biome-ignore lint: check active rules
    await db.insert(assistantRuleSets).values(activeRuleSet);
    console.log('Rule set seeded.');
  } catch (err) {
    console.log('Rule set might already exist or failed:', err);
  }

  let inserted = 0;
  let failed = 0;

  console.log('Generating local embeddings and inserting items...');
  for (const item of items) {
    const searchableText = `Categoría: ${item.categoria}. Contexto: ${item.contexto_situacional}. Último mensaje recibido: ${item.ultimo_mensaje_ella}.`;
    const hash = crypto.createHash('sha256').update(searchableText).digest('hex');

    // Normalize category
    let cat = (item.categoria || '').toLowerCase().replace('-', '_');
    if (cat === 'shit_test') cat = 'shit_test'; // verify standard names

    try {
      // Generate 768-dimension local embedding
      const embedding = await generateEmbedding(searchableText);

      const dbValue = {
        category: cat,
        situationalContext: item.contexto_situacional,
        lastMessage: item.ultimo_mensaje_ella,
        psychologicalAnalysis: item.analisis_subtexto_psicologico,
        options: item.opciones,
        searchableText,
        embedding,
        sourceHash: hash,
        active: true,
      };

      await db
        .insert(chatExamples)
        .values(dbValue)
        .onConflictDoUpdate({
          target: chatExamples.sourceHash,
          set: {
            category: dbValue.category,
            situationalContext: dbValue.situationalContext,
            lastMessage: dbValue.lastMessage,
            psychologicalAnalysis: dbValue.psychologicalAnalysis,
            options: dbValue.options,
            searchableText: dbValue.searchableText,
            embedding: dbValue.embedding,
            active: dbValue.active,
            updatedAt: new Date(),
          },
        });
      inserted++;
    } catch (err) {
      console.error(`Failed to ingest item with ID ${item.id}:`, err);
      failed++;
    }
  }

  console.log(`Seeding completed. Total: ${items.length}, Processed: ${inserted}, Failed: ${failed}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Ingestion script crashed:', err);
  process.exit(1);
});
