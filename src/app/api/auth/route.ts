import { randomUUID, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

function sessionToken(userId: string) {
  const secret = process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "nexora-development-secret-change-me");
  if (!secret) throw new Error("AUTH_SECRET must be configured in production.");
  return `${userId}.${createHmac("sha256", secret).update(userId).digest("hex")}`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ user: null });
  const result = await getDb().execute({
    sql: "SELECT preferred_tone, preferred_style FROM users WHERE id = ?",
    args: [user.id],
  });
  return NextResponse.json({ user: { ...user, ...result.rows[0] } });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "Authentication is not configured. Set AUTH_SECRET before enabling sign in." },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = "action" in body ? body.action : "";
  const email =
    "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const password =
    "password" in body && typeof body.password === "string"
      ? body.password
      : "";
  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "Enter a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  await initDb();
  const db = getDb();
  if (action === "signup") {
    const displayName =
      "name" in body && typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : email.split("@")[0];
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (existing.rows[0]) {
      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    }
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)`,
      args: [userId, email, passwordHash, displayName],
    });
    const response = NextResponse.json({
      user: { id: userId, email, display_name: displayName },
    });
    response.cookies.set("nexora_session", sessionToken(userId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  if (action === "signin") {
    const result = await db.execute({
      sql: "SELECT id, email, display_name, password_hash FROM users WHERE email = ?",
      args: [email],
    });
    const user = result.rows[0];
    if (!user?.password_hash || !await bcrypt.compare(password, String(user.password_hash))) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
    });
    response.cookies.set("nexora_session", sessionToken(String(user.id)), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  return NextResponse.json({ error: "Unknown auth action." }, { status: 400 });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("nexora_session", "", { path: "/", maxAge: 0 });
  return response;
}
