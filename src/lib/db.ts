import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: process.env.NEXORA_DB_URL || "file:nexora.db",
      authToken: process.env.NEXORA_DB_AUTH_TOKEN,
    });
  }
  return client;
}

export async function initDb() {
  const db = getDb();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      preferred_tone TEXT DEFAULT 'balanced',
      preferred_style TEXT DEFAULT 'concise',
      interests TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model_id TEXT,
      mode TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      user_id TEXT,
      name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      storage_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
  ]);
  const userColumns = await db.execute("PRAGMA table_info(users)");
  const existingColumns = new Set(userColumns.rows.map((row) => String(row.name)));
  for (const [column, definition] of [
    ["email", "TEXT"],
    ["password_hash", "TEXT"],
    ["display_name", "TEXT"],
  ]) {
    if (!existingColumns.has(column)) {
      await db.execute(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
}
