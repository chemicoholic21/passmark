import OpenAI from "openai";
import { ConfigurationError } from "../errors";
import { getConfig } from "../config";

let _client: OpenAI | null = null;

/**
 * Returns a lazy singleton OpenAI client for CUA mode.
 *
 * CUA requires direct OpenAI access (Responses API + built-in `computer` tool).
 * Throws ConfigurationError if OPENAI_API_KEY is missing, or if the user has
 * combined `mode: "cua"` with a non-"none" gateway (which would route through
 * a proxy that does not expose the Responses API).
 */
export function getOpenAIClient(): OpenAI {
  const gateway = getConfig().ai?.gateway ?? "none";
  if (gateway !== "none") {
    throw new ConfigurationError(
      `CUA mode requires gateway: "none" (got "${gateway}"). ` +
        `The OpenAI Responses API computer tool is only available on direct OpenAI access. ` +
        `Set configure({ ai: { mode: "cua", gateway: "none" } }) and provide OPENAI_API_KEY.`,
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new ConfigurationError(
      "OPENAI_API_KEY isn't set. CUA mode uses OpenAI's Responses API — add OPENAI_API_KEY to your environment.",
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/** @internal Reset client singleton. Used for testing only. */
export function resetOpenAIClient() {
  _client = null;
}
