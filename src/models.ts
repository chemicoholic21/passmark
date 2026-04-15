import { AIModelError, ConfigurationError } from "./errors";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { gateway, type LanguageModel } from "ai";
import { wrapAISDKModel } from "axiom/ai";
import { getConfig } from "./config";
import { axiomEnabled } from "./instrumentation";

function wrapModel(model: LanguageModel): LanguageModel {
  return axiomEnabled ? wrapAISDKModel(model) : model;
}

let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let _anthropic: ReturnType<typeof createAnthropic> | null = null;
let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
let _cloudflareGateway: ReturnType<typeof createAiGateway> | null = null;
let _cloudflareUnified: ReturnType<typeof createUnified> | null = null;

function getGoogleProvider() {
  if (!_google) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new ConfigurationError(
        "GOOGLE_GENERATIVE_AI_API_KEY isn't set. Add it to your environment (for example: export GOOGLE_GENERATIVE_AI_API_KEY=your_key), or use a gateway: configure({ ai: { gateway: 'vercel' } }) with AI_GATEWAY_API_KEY, configure({ ai: { gateway: 'openrouter' } }) with OPENROUTER_API_KEY, or configure({ ai: { gateway: 'cloudflare' } }) with CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY, and CLOUDFLARE_AI_GATEWAY_API_KEY. See .env.example for reference.",
      );
    }
    _google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  }
  return _google;
}

function getAnthropicProvider() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ConfigurationError(
        "ANTHROPIC_API_KEY isn't set. Add it to your environment (for example: export ANTHROPIC_API_KEY=your_key), or use a gateway: configure({ ai: { gateway: 'vercel' } }) with AI_GATEWAY_API_KEY, configure({ ai: { gateway: 'openrouter' } }) with OPENROUTER_API_KEY, or configure({ ai: { gateway: 'cloudflare' } }) with CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY, and CLOUDFLARE_AI_GATEWAY_API_KEY. See .env.example for reference.",
      );
    }
    _anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

function getOpenRouterProvider() {
  if (!_openrouter) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new ConfigurationError(
        "OPENROUTER_API_KEY isn't set. Add it to your environment (for example: export OPENROUTER_API_KEY=your_key). See .env.example for reference.",
      );
    }
    _openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _openrouter;
}

function getCloudflareAiGateway() {
  if (!_cloudflareGateway) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const gatewayName = process.env.CLOUDFLARE_AI_GATEWAY;
    const apiKey = process.env.CLOUDFLARE_AI_GATEWAY_API_KEY;
    if (!accountId || !gatewayName || !apiKey) {
      throw new ConfigurationError(
        "Cloudflare AI Gateway requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY (gateway name), and CLOUDFLARE_AI_GATEWAY_API_KEY. See https://developers.cloudflare.com/ai-gateway/integrations/vercel-ai-sdk/ and .env.example.",
      );
    }
    _cloudflareGateway = createAiGateway({
      accountId,
      gateway: gatewayName,
      apiKey,
    });
  }
  return _cloudflareGateway;
}

function getCloudflareUnified() {
  if (!_cloudflareUnified) {
    const unifiedApiKey = process.env.CLOUDFLARE_AI_UNIFIED_API_KEY;
    _cloudflareUnified = createUnified(
      unifiedApiKey ? { apiKey: unifiedApiKey } : undefined,
    );
  }
  return _cloudflareUnified;
}

/**
 * Maps canonical model names to direct Google/Anthropic API names.
 * Only needed where the gateway name differs from the direct provider name.
 * Add new entries here when providers rename or graduate models.
 */
const MODEL_DIRECT_ALIASES: Record<string, string> = {
  "gemini-3-flash": "gemini-3-flash-preview",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-haiku-4.5": "claude-haiku-4-5",
};

function resolveDirectModelName(modelName: string): string {
  return MODEL_DIRECT_ALIASES[modelName] ?? modelName;
}

/**
 * Maps canonical model IDs (provider/model) to OpenRouter model IDs.
 * OpenRouter uses its own naming — add entries here when they differ from canonical IDs.
 */
const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-3-flash": "google/gemini-3-flash-preview",
};

function resolveOpenRouterModelId(modelId: string): string {
  return OPENROUTER_MODEL_ALIASES[modelId] ?? modelId;
}

/**
 * Cloudflare Unified (OpenAI compat) expects `google-ai-studio/<model>` for Gemini via
 * Google AI Studio provider keys, not `google/<model>` (which yields Invalid provider / 2008).
 * Skip when the id already targets AI Studio, Vertex, or Workers AI.
 * @see https://developers.cloudflare.com/ai-gateway/usage/chat-completion/
 */
function rewriteGooglePrefixForCloudflareUnified(modelId: string): string {
  if (
    modelId.startsWith("google-ai-studio/") ||
    modelId.startsWith("google-vertex-ai/") ||
    modelId.startsWith("workers-ai/")
  ) {
    return modelId;
  }
  if (modelId.startsWith("google/")) {
    return `google-ai-studio/${modelId.slice("google/".length)}`;
  }
  return modelId;
}

/**
 * Resolves Passmark canonical model ids to Cloudflare AI Gateway Unified model ids.
 * Applies the same Google model-name aliases as the direct API (`google/gemini-3-flash` →
 * `google-ai-studio/gemini-3-flash-preview`) so Unified does not call a non-existent model id.
 * Exported for unit tests.
 */
export function resolveCloudflareUnifiedModelId(modelId: string): string {
  const rewritten = rewriteGooglePrefixForCloudflareUnified(modelId);
  if (rewritten.startsWith("google-ai-studio/")) {
    const modelName = rewritten.slice("google-ai-studio/".length);
    return `google-ai-studio/${resolveDirectModelName(modelName)}`;
  }
  return rewritten;
}

/**
 * Resolves a canonical model ID to a LanguageModel instance wrapped with Axiom instrumentation.
 * Input format: "provider/model-name" (e.g. "google/gemini-3-flash")
 *
 * Users always use canonical IDs (gateway-style). When using direct providers,
 * model names are automatically mapped to the correct provider-specific names
 * (e.g. "gemini-3-flash" → "gemini-3-flash-preview" for Google's direct API).
 *
 * When gateway is "vercel", routes through the Vercel AI Gateway as-is.
 * When gateway is "cloudflare", routes through Cloudflare AI Gateway using the Unified API.
 * When gateway is "none" (default), creates a direct provider instance with alias resolution.
 * All paths wrap the model with wrapAISDKModel for tracing when Axiom is enabled.
 */
export function resolveModel(modelId: string): LanguageModel {
  const gatewayConfig = getConfig().ai?.gateway ?? "none";

  if (gatewayConfig === "vercel") {
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new ConfigurationError(
        "AI_GATEWAY_API_KEY isn't set. To use the Vercel AI Gateway, add AI_GATEWAY_API_KEY to your environment. If you'd rather use direct provider keys, call configure({ ai: { gateway: 'none' } }) and set GOOGLE_GENERATIVE_AI_API_KEY and/or ANTHROPIC_API_KEY.",
      );
    }
    return wrapModel(gateway(modelId));
  }

  if (gatewayConfig === "openrouter") {
    return wrapModel(getOpenRouterProvider()(resolveOpenRouterModelId(modelId)));
  }

  if (gatewayConfig === "cloudflare") {
    const unifiedId = resolveCloudflareUnifiedModelId(modelId);
    return wrapModel(getCloudflareAiGateway()(getCloudflareUnified()(unifiedId)));
  }

  const [provider, ...rest] = modelId.split("/");
  const modelName = rest.join("/");

  switch (provider) {
    case "google":
      return wrapModel(getGoogleProvider()(resolveDirectModelName(modelName)));
    case "anthropic":
      return wrapModel(getAnthropicProvider()(resolveDirectModelName(modelName)));
    default:
      throw new AIModelError(`Unknown AI provider: ${provider}`);
  }
}