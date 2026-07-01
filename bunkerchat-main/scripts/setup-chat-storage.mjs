import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;
const PROJECT_REF = process.env.SUPABASE_PROJECT_ID || "uiitchmdluahrzgcfsgh";

const policySql = `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat uploads insert'
  ) THEN
    CREATE POLICY "chat uploads insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'chat-uploads'
      AND (storage.foldername(name))[1] IN (
        SELECT conversation_id::text FROM public.conversation_participants WHERE user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat uploads select'
  ) THEN
    CREATE POLICY "chat uploads select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'chat-uploads'
      AND (storage.foldername(name))[1] IN (
        SELECT conversation_id::text FROM public.conversation_participants WHERE user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat uploads update'
  ) THEN
    CREATE POLICY "chat uploads update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'chat-uploads'
      AND (storage.foldername(name))[1] IN (
        SELECT conversation_id::text FROM public.conversation_participants WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
`;

const functionSql = readFileSync(
  resolve(root, "supabase/migrations/20260701170100_ensure_bunker_storage.sql"),
  "utf8",
);

async function ensureBucketWithServiceRole() {
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw listErr;

  if (!buckets?.some((b) => b.id === "chat-uploads")) {
    const { error } = await admin.storage.createBucket("chat-uploads", {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
    });
    if (error) throw error;
    console.log("✓ Bucket chat-uploads criado");
  } else {
    console.log("✓ Bucket chat-uploads já existe");
  }
  return true;
}

async function runSqlWithPassword() {
  if (!DB_PASSWORD) return false;
  const url = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  const sql = postgres(url, { ssl: "require", max: 1 });
  try {
    await sql.unsafe(functionSql);
    console.log("✓ Funções ensure_chat_storage / ensure_bunker_conversation atualizadas");
    await sql.unsafe(policySql);
    console.log("✓ Políticas de storage aplicadas");
    return true;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  console.log("Configurando storage do Bunker Chat...");

  let ok = false;
  try {
    ok = await ensureBucketWithServiceRole();
  } catch (err) {
    console.error("Falha ao criar bucket via service role:", err.message);
  }

  try {
    const sqlOk = await runSqlWithPassword();
    ok = ok || sqlOk;
  } catch (err) {
    console.error("Falha ao aplicar SQL via senha do banco:", err.message);
  }

  if (!ok) {
    console.error(
      "\nNão foi possível aplicar automaticamente. Adicione no .env:\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=... (Settings → API no Supabase)\n" +
        "  SUPABASE_DB_PASSWORD=... (Settings → Database no Supabase)\n" +
        "Depois rode: bun run setup:storage",
    );
    process.exit(1);
  }

  console.log("\nStorage configurado com sucesso.");
}

main();
