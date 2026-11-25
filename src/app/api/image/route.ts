import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null ||
      !("prompt" in body) || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Add OPENROUTER_API_KEY to generate images." }, { status: 503 });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXORA_SITE_URL || "http://localhost:3000",
      "X-Title": "Nexora",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: body.prompt }],
    }),
  });

  if (!response.ok) {
    const fallbackUrl =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(body.prompt)}`
      + "?width=1024&height=1024&nologo=true";
    try {
      const fallback = await fetch(fallbackUrl);
      if (fallback.ok) {
        const contentType = fallback.headers.get("content-type") || "image/jpeg";
        if (contentType.startsWith("image/")) {
          const bytes = Buffer.from(await fallback.arrayBuffer());
          return NextResponse.json({
            url: `data:${contentType};base64,${bytes.toString("base64")}`,
            model: "pollinations-free",
          });
        }
      }
    } catch {
      // Continue to the provider error below.
    }
    const detail = await response.text();
    return NextResponse.json(
      { error: "Image generation failed.", detail: detail.slice(0, 500) },
      { status: response.status },
    );
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }>; content?: unknown } }>;
  };
  const message = data.choices?.[0]?.message;
  const url = message?.images?.find((image) => image.image_url?.url)?.image_url?.url;
  if (!url) {
    return NextResponse.json(
      { error: "The selected image model returned no image. Image generation may require OpenRouter credits." },
      { status: 502 },
    );
  }
  return NextResponse.json({ url, model: "google/gemini-3.1-flash-lite-image" });
}
