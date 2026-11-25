import { NextResponse } from "next/server";
import { getChatModels } from "@/lib/models";

export async function GET() {
  try {
    const models = await getChatModels();
    return NextResponse.json({
      models,
      defaultModel: process.env.NEXORA_MODEL || "openai/gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Failed to load the AI Gateway model catalog.", error);
    return NextResponse.json(
      { error: "Could not load the AI model catalog. Please try again later." },
      { status: 502 },
    );
  }
}
