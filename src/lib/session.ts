import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb, initDb } from "@/lib/db";

function authSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") return null;
  return "nexora-development-secret-change-me";
}

function sessionUserId(token: string) {
  const secret = authSecret();
  if (!secret) return "";
  const separator = token.lastIndexOf(".");
  if (separator < 1) return "";

  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  if (signature.length !== expected.length) return "";

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ? userId
    : "";
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get("nexora_session")?.value;
  if (!token) return null;
  const userId = sessionUserId(token);
  if (!userId) return null;

  await initDb();
  const result = await getDb().execute({
    sql: "SELECT id, email, display_name FROM users WHERE id = ?",
    args: [userId],
  });
  return result.rows[0] || null;
}

export async function getAdminUser(request: NextRequest) {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) return { status: "unconfigured" as const, user: null };
  const user = await getSessionUser(request);
  if (!user) return { status: "unauthenticated" as const, user: null };
  if (String(user.email || "").toLowerCase() !== configuredEmail) {
    return { status: "forbidden" as const, user: null };
  }
  return { status: "ok" as const, user };
}
