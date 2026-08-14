import crypto from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const databaseUrl = process.env.MIGRATION_DATABASE_URL || required('POSTGRES_URL');
const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const encryptionKey = Buffer.from(required('BACKUP_ENCRYPTION_KEY'), 'base64');
if (encryptionKey.length !== 32) {
  throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
}

const bucket = process.env.PRIVATE_DATASET_BUCKET || 'private-datasets';
const version = process.env.DATASET_VERSION || new Date().toISOString().replaceAll(':', '-');
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const rows = await sql`select * from chat_examples order by created_at, id`;
  const plaintext = Buffer.from(JSON.stringify(rows));
  const checksum = crypto.createHash('sha256').update(plaintext).digest('hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = Buffer.from(JSON.stringify({
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    checksum,
    count: rows.length,
    ciphertext: encrypted.toString('base64'),
  }));

  const { data: existingBucket, error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError && bucketError.message !== 'Bucket not found') throw bucketError;
  if (!existingBucket) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false });
    if (error) throw error;
  } else if (existingBucket.public) {
    throw new Error(`Refusing to export to public bucket: ${bucket}`);
  }

  const objectPath = `chat-examples/${version}/${checksum}.json.enc`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, envelope, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  console.log(JSON.stringify({ bucket, objectPath, checksum, count: rows.length }, null, 2));
} finally {
  await sql.end();
}
