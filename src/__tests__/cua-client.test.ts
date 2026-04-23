import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configure, resetConfig } from "../config";
import { getOpenAIClient, resetOpenAIClient } from "../cua/client";
import { ConfigurationError } from "../errors";

describe("cua/client/getOpenAIClient", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    resetConfig();
    resetOpenAIClient();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });

  it("throws ConfigurationError when gateway is not 'none'", () => {
    configure({ ai: { gateway: "openrouter", mode: "cua" } });
    process.env.OPENAI_API_KEY = "sk-test";
    expect(() => getOpenAIClient()).toThrow(ConfigurationError);
    expect(() => getOpenAIClient()).toThrow(/gateway: "none"/);
  });

  it("throws ConfigurationError when OPENAI_API_KEY is missing", () => {
    configure({ ai: { mode: "cua" } });
    delete process.env.OPENAI_API_KEY;
    expect(() => getOpenAIClient()).toThrow(ConfigurationError);
    expect(() => getOpenAIClient()).toThrow(/OPENAI_API_KEY/);
  });

  it("returns a client when gateway='none' and key is set", () => {
    configure({ ai: { mode: "cua", gateway: "none" } });
    process.env.OPENAI_API_KEY = "sk-test";
    const client = getOpenAIClient();
    expect(client).toBeDefined();
    // Singleton: second call returns the same instance.
    expect(getOpenAIClient()).toBe(client);
  });
});
