import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  gateway,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getChatModels, type ChatModel } from "@/lib/models";
import { getDb, initDb } from "@/lib/db";
import { selectModel, type CreativeMode } from "@/lib/model-router";

export const maxDuration = 30;

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
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    !("modelId" in body) ||
    ("modelId" in body && typeof body.modelId !== "string")
  ) {
    return NextResponse.json(
      { error: "A message history is required." },
      { status: 400 },
    );
  }

  const modelValidation = await safeValidateUIMessages<UIMessage>({
    messages: body.messages,
  });
  if (!modelValidation.success || modelValidation.data.length === 0) {
    return NextResponse.json(
      { error: "The message history is invalid or empty." },
      { status: 400 },
    );
  }

  let models: ChatModel[];
  try {
    models = await getChatModels();
  } catch (error) {
    console.error("Failed to retrieve AI Gateway models for chat validation.", error);
    return NextResponse.json(
      { error: "The AI model catalog is temporarily unavailable." },
      { status: 503 },
    );
  }

  const lastUserMessage = modelValidation.data
    .filter((message) => message.role === "user")
    .at(-1);
  const prompt =
    lastUserMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n") || "";
  const attachments =
    "attachments" in body && Array.isArray(body.attachments)
      ? body.attachments.filter(
          (item): item is { name: string; type: string; text?: string } =>
            typeof item === "object" && item !== null &&
            "name" in item && typeof item.name === "string" &&
            "type" in item && typeof item.type === "string",
        )
      : [];
  const attachmentContext = attachments
    .map((attachment) =>
      attachment.text
        ? `\n\nAttached file "${attachment.name}" (${attachment.type}):\n${attachment.text.slice(0, 12000)}`
        : `\n\nAttached file "${attachment.name}" (${attachment.type}).`
    )
    .join("");
  const fileParts =
    lastUserMessage?.parts.filter((part) => part.type === "file") || [];
  const fileContext = fileParts
    .map((part) =>
      part.type === "file"
        ? `\n\nAttached ${part.mediaType} file "${part.filename || "upload"}".`
        : "",
    )
    .join("");
  const fullAttachmentContext = `${attachmentContext}${fileContext}`;
  const fullPrompt = `${prompt}${fullAttachmentContext}`;
  const mode =
    "mode" in body && typeof body.mode === "string"
      ? (body.mode as CreativeMode)
      : "auto";
  const modelId =
    "modelId" in body &&
    typeof body.modelId === "string" &&
    body.modelId !== "auto" &&
    models.some((model) => model.id === body.modelId)
      ? body.modelId
      : selectModel(fullPrompt, mode, models);

  if (!modelId) {
    return NextResponse.json(
      { error: "No suitable model is available." },
      { status: 503 },
    );
  }

  if (!models.some((model) => model.id === modelId)) {
    return NextResponse.json(
      { error: "That model is not available for chat. Choose another model." },
      { status: 400 },
    );
  }

  let memory = "";
  let userId = "";
  let conversationId = "";
  const conversationTitle = fullPrompt.slice(0, 80);
  if ("userId" in body && typeof body.userId === "string") {
    userId = body.userId;
    try {
      await initDb();
      conversationId =
        "conversationId" in body && typeof body.conversationId === "string"
          ? body.conversationId
          : randomUUID();
      await getDb().batch([
        {
          sql: "INSERT OR IGNORE INTO users (id) VALUES (?)",
          args: [userId],
        },
        {
          sql: `INSERT OR IGNORE INTO conversations (id, user_id, title)
                VALUES (?, ?, ?)`,
          args: [conversationId, userId, conversationTitle || "New conversation"],
        },
        {
          sql: `INSERT INTO messages (id, conversation_id, user_id, role, content, model_id, mode)
                VALUES (?, ?, ?, 'user', ?, ?, ?)`,
          args: [randomUUID(), conversationId, userId, fullPrompt, modelId, mode],
        },
      ]);
      const profileResult = await getDb().execute({
        sql: "SELECT preferred_tone, preferred_style FROM users WHERE id = ?",
        args: [userId],
      });
      const profile = profileResult.rows[0];
      if (profile) {
        memory = `User preferences: tone=${String(profile.preferred_tone)}, style=${String(profile.preferred_style)}.`;
      }
    } catch (databaseError) {
      console.warn("Chat database unavailable; continuing without persistence.", databaseError);
      userId = "";
      conversationId = "";
    }
  }

  const openRouter = process.env.OPENROUTER_API_KEY
    ? createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: {
          "HTTP-Referer": process.env.NEXORA_SITE_URL || "http://localhost:3000",
          "X-Title": "Nexora",
        },
      })
    : null;

  const result = streamText({
    model: openRouter ? openRouter.chatModel(modelId) : gateway(modelId),
    system:
      `You are Nexora, a careful and creative AI assistant. Prioritize correctness over confidence. Do not invent facts, citations, or capabilities. If a request depends on current or missing information, say what is uncertain and ask a focused clarifying question. Adapt to the user's language and preferences, and produce clear, practical, engaging answers. ${memory}${fullAttachmentContext}`,
    messages: await convertToModelMessages(modelValidation.data),
    onFinish: async ({ text }) => {
      if (!userId || !conversationId) return;
      await getDb().execute({
        sql: `INSERT INTO messages (id, conversation_id, user_id, role, content, model_id, mode)
              VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
        args: [randomUUID(), conversationId, userId, text, modelId, mode],
      });
      await getDb().execute({
        sql: "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [conversationId],
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
    headers: {
      "X-Nexora-Model": modelId,
      "X-Nexora-Conversation": conversationId,
    },
  });
}
