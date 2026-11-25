import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAdminUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const auth = await getAdminUser(request);
  if (auth.status === "unconfigured") {
    return NextResponse.json(
      { error: "Set ADMIN_EMAIL in .env.local, then sign in with that account." },
      { status: 503 },
    );
  }
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "Sign in with the admin account to continue." }, { status: 401 });
  }
  if (auth.status !== "ok") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const db = getDb();
  const [users, conversations, messages, recentConversations, recentUsers] =
    await Promise.all([
      db.execute("SELECT COUNT(*) AS count FROM users"),
      db.execute("SELECT COUNT(*) AS count FROM conversations"),
      db.execute("SELECT COUNT(*) AS count FROM messages"),
      db.execute(`SELECT c.id, c.title, c.created_at, c.updated_at, u.email,
                         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
                  FROM conversations c
                  LEFT JOIN users u ON u.id = c.user_id
                  ORDER BY c.updated_at DESC LIMIT 50`),
      db.execute(`SELECT id, email, display_name, preferred_tone, preferred_style, updated_at
                  FROM users ORDER BY updated_at DESC LIMIT 100`),
    ]);

  return NextResponse.json({
    stats: {
      users: Number(users.rows[0]?.count || 0),
      conversations: Number(conversations.rows[0]?.count || 0),
      messages: Number(messages.rows[0]?.count || 0),
    },
    conversations: recentConversations.rows,
    users: recentUsers.rows,
  });
}
