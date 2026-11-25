import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "A user ID is required." }, { status: 400 });
  }

  await initDb();
  const db = getDb();
  await db.execute({
    sql: "INSERT OR IGNORE INTO users (id) VALUES (?)",
    args: [userId],
  });
  const profile = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [userId],
  });
  const history = await db.execute({
    sql: `SELECT id, conversation_id, role, content, model_id, mode, created_at
          FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    args: [userId],
  });

  return NextResponse.json({
    profile: profile.rows[0] || null,
    history: history.rows.reverse(),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("userId" in body) ||
    typeof body.userId !== "string"
  ) {
    return NextResponse.json({ error: "A user ID is required." }, { status: 400 });
  }

  const tone = "tone" in body && typeof body.tone === "string" ? body.tone : "balanced";
  const style = "style" in body && typeof body.style === "string" ? body.style : "concise";

  await initDb();
  await getDb().execute({
    sql: `INSERT INTO users (id, preferred_tone, preferred_style, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            preferred_tone = excluded.preferred_tone,
            preferred_style = excluded.preferred_style,
            updated_at = CURRENT_TIMESTAMP`,
    args: [body.userId, tone, style],
  });

  return NextResponse.json({ ok: true });
}
