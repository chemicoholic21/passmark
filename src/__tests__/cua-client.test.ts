import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetConfig } from "../config";
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

  it("throws ConfigurationError when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getOpenAIClient()).toThrow(ConfigurationError);
    expect(() => getOpenAIClient()).toThrow(/OPENAI_API_KEY/);
  });

  it("returns a client when key is set, and is a singleton", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const client = getOpenAIClient();
    expect(client).toBeDefined();
    expect(getOpenAIClient()).toBe(client);
  });
});
