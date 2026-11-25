import type { ChatModel } from "@/lib/models";

export type CreativeMode = "auto" | "creative" | "deep" | "code" | "plan" | "image";

function firstAvailable(models: ChatModel[], candidates: string[]) {
  for (const candidate of candidates) {
    const model = models.find((item) => item.id === candidate);
    if (model) return model.id;
  }
  return "";
}

export function selectModel(
  prompt: string,
  mode: CreativeMode,
  models: ChatModel[],
) {
  const normalized = prompt.toLowerCase();

  if (process.env.OPENROUTER_API_KEY) {
    const freeCandidates =
      mode === "code"
        ? ["openrouter/free"]
        : mode === "creative"
          ? ["openrouter/free"]
          : mode === "deep"
            ? ["openrouter/free"]
            : mode === "plan"
              ? ["openrouter/free"]
              : ["openrouter/free"];
    return (
      firstAvailable(models, freeCandidates) ||
      models.find((model) => model.id.endsWith(":free"))?.id ||
      models[0]?.id
    );
  }

  if (mode === "creative") {
    return (
      firstAvailable(models, [
        "anthropic/claude-sonnet-4.5",
        "google/gemini-2.5-pro",
        "openai/gpt-4.1",
      ]) || models[0]?.id
    );
  }

  if (mode === "code" || /(^|[^a-z])(code|typescript|javascript|python|react|bug|debug|api|database|sql|function|class)([^a-z]|$)/.test(normalized)) {
    return (
      firstAvailable(models, [
        "alibaba/qwen3-coder-30b-a3b",
        "openai/gpt-4.1",
        "anthropic/claude-sonnet-4.5",
      ]) || models[0]?.id
    );
  }

  if (mode === "deep" || /(^|[^a-z])(analyze|reason|prove|research|complex|strategy|compare|tradeoff|architecture)([^a-z]|$)/.test(normalized)) {
    return (
      firstAvailable(models, [
        "deepseek/deepseek-r1",
        "google/gemini-2.5-pro",
        "anthropic/claude-opus-4.5",
        "openai/gpt-4.1",
      ]) || models[0]?.id
    );
  }

  if (mode === "plan" || /(^|[^a-z])(plan|roadmap|steps|project|schedule|timeline)([^a-z]|$)/.test(normalized)) {
    return (
      firstAvailable(models, [
        "anthropic/claude-sonnet-4.5",
        "google/gemini-2.5-pro",
        "openai/gpt-4.1",
      ]) || models[0]?.id
    );
  }

  return (
    firstAvailable(models, [
      "openai/gpt-4.1-mini",
      "google/gemini-3.1-flash-lite",
      "anthropic/claude-haiku-4.5",
    ]) || models[0]?.id
  );
}
