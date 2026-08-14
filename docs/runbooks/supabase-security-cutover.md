# Supabase security cutover

Do not apply the security migration until the project owner has produced an
encrypted backup and restored it successfully into a disposable Supabase branch.

## 1. Capture the baseline

Use the Session pooler/direct migration URL, never the runtime transaction pooler.

```bash
mkdir -p "$BACKUP_DIR"
pnpm security:dataset-manifest > "$BACKUP_DIR/before.json"
pg_dump --format=custom --no-owner --no-acl \
  --file "$BACKUP_DIR/chatbot-dms.dump" "$MIGRATION_DATABASE_URL"
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "$BACKUP_DIR/chatbot-dms.dump" \
  -out "$BACKUP_DIR/chatbot-dms.dump.enc"
```

Store the encrypted dump and `before.json` outside this public repository. Delete
the plaintext dump after confirming that the encrypted file can be decrypted.

## 2. Restore rehearsal

Create a disposable Supabase branch and point `RESTORE_DATABASE_URL` to its
Session pooler. Never restore into the production project.

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$BACKUP_DIR/chatbot-dms.dump.enc" \
  -out "$BACKUP_DIR/chatbot-dms.restore.dump"
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname "$RESTORE_DATABASE_URL" "$BACKUP_DIR/chatbot-dms.restore.dump"
MIGRATION_DATABASE_URL="$RESTORE_DATABASE_URL" \
  pnpm security:dataset-manifest > "$BACKUP_DIR/restored.json"
```

The table counts, dataset checksum, and manifest checksum in `before.json` and
`restored.json` must match. Destroy the disposable branch and plaintext dump.

## 3. Production cutover

1. Apply `0009_lock_down_public_data_api.sql` with the migration connection.
2. In Supabase **Data API settings**, expose a dedicated empty `api` schema instead
   of `public`. Auth and Storage APIs are configured separately and remain usable.
3. Rotate `AUTH_SECRET` to invalidate guest sessions.
4. Delete stale `guest-%` users only after the backup rehearsal succeeds.
5. Run `pnpm security:audit-data-api`; it must exit successfully.
6. Verify guest sign-in, chat generation, generation-run logging, and feedback.

Never roll back by granting `anon` or `authenticated` access to application tables.
Roll back application code or restore the encrypted backup instead.
