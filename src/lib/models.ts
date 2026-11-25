export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  inputPrice?: number;
  outputPrice?: number;
};

type GatewayModel = {
  id?: unknown;
  name?: unknown;
  owned_by?: unknown;
  type?: unknown;
  modalities?: {
    output?: unknown;
  };
  pricing?: {
    input?: unknown;
    output?: unknown;
  };
};

type GatewayModelResponse = {
  data?: unknown;
};

export async function getChatModels(): Promise<ChatModel[]> {
  if (process.env.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      throw new Error(`OpenRouter model catalog returned ${response.status}`);
    }

    const catalog = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        name?: unknown;
        pricing?: { prompt?: unknown; completion?: unknown };
        architecture?: { output_modalities?: unknown };
      }>;
    };
    if (!Array.isArray(catalog.data)) {
      throw new Error("OpenRouter returned an invalid model catalog");
    }

    return catalog.data
      .filter((model) =>
        typeof model.id === "string" &&
        typeof model.name === "string" &&
        typeof model.pricing?.prompt === "string" &&
        typeof model.pricing.completion === "string" &&
        model.pricing.prompt === "0" &&
        model.pricing.completion === "0" &&
        Array.isArray(model.architecture?.output_modalities) &&
        model.architecture.output_modalities.includes("text"),
      )
      .map((model) => ({
        id: model.id as string,
        name: model.name as string,
        provider: "openrouter",
        inputPrice: 0,
        outputPrice: 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`AI Gateway model catalog returned ${response.status}`);
  }

  const catalog = (await response.json()) as GatewayModelResponse;
  if (!Array.isArray(catalog.data)) {
    throw new Error("AI Gateway returned an invalid model catalog");
  }

  return (catalog.data as GatewayModel[])
    .filter(
      (model) =>
        model.type === "language" &&
        Array.isArray(model.modalities?.output) &&
        model.modalities.output.includes("text") &&
        typeof model.id === "string" &&
        typeof model.name === "string" &&
        typeof model.owned_by === "string",
    )
    .map((model) => ({
      id: model.id as string,
      name: model.name as string,
      provider: model.owned_by as string,
      inputPrice:
        typeof model.pricing?.input === "string" ||
        typeof model.pricing?.input === "number"
          ? Number(model.pricing.input) * 1_000_000
          : undefined,
      outputPrice:
        typeof model.pricing?.output === "string" ||
        typeof model.pricing?.output === "number"
          ? Number(model.pricing.output) * 1_000_000
          : undefined,
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
}
