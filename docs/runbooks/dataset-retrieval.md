# Dataset and retrieval runbook

The dating-DM dataset is private operational data. Never commit source examples, exports, evaluation scenarios, database dumps, service-role keys, or encryption keys.

## 1. Export an encrypted version

Use an owner-approved direct PostgreSQL URL and a Supabase service-role key. The script refuses public buckets and encrypts the JSON with AES-256-GCM before upload.

```powershell
$env:BACKUP_ENCRYPTION_KEY = '<base64 32-byte key>'
$env:SUPABASE_SERVICE_ROLE_KEY = '<service role key>'
$env:DATASET_VERSION = 'dating-dm-2026-08-14'
pnpm dataset:export-private
```

Record the returned object path, row count, and SHA-256 checksum in the private change record.

## 2. Validate an import without side effects

```powershell
pnpm ingest:examples -- --dataset C:\private\dataset.json --version dating-dm-2026-08-14 --locale es-AR --dry-run
```

The current 200-example legacy corpus must be labeled `es-AR`; it is Rioplatense evidence, not LATAM-wide coverage.

## 3. Import semantic embeddings

After migration `0011` is applied and backup restoration has been verified:

```powershell
$env:RAG_EMBEDDING_MODEL = 'text-embedding-3-small'
pnpm ingest:examples -- --dataset C:\private\dataset.json --version dating-dm-2026-08-14 --locale es-AR
```

The importer validates the complete file before writing, embeds in batches, and writes examples, locale rule sets, and dataset lineage in one transaction. Repeating the same version is idempotent.

## 4. Enable semantic retrieval gradually

Keep `RAG_EMBEDDING_MODE=legacy` until every active example has `embedding_v2`, model, and version 2. Enable `semantic` first in shadow evaluation. Never restore access by reopening the Data API.
