import { describe, it, expect, beforeEach } from "vitest";
import { configure, getMode, getModelId, resetConfig, DEFAULT_MODELS } from "../config";

describe("cua config", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("getMode defaults to snapshot", () => {
    expect(getMode()).toBe("snapshot");
  });

  it("configure sets mode to cua", () => {
    configure({ ai: { mode: "cua" } });
    expect(getMode()).toBe("cua");
  });

  it("mode survives merges with other config", () => {
    configure({ ai: { mode: "cua" } });
    configure({ uploadBasePath: "./tmp" });
    expect(getMode()).toBe("cua");
  });

  it("default cua model is gpt-5.5", () => {
    expect(getModelId("cua")).toBe("gpt-5.5");
    expect(DEFAULT_MODELS.cua).toBe("gpt-5.5");
  });

  it("configure throws when user tries to override cua model", () => {
    expect(() =>
      configure({ ai: { models: { cua: "custom-cua-model" } } }),
    ).toThrow(/cua.*not user-configurable/);
    // Default still wins.
    expect(getModelId("cua")).toBe("gpt-5.5");
  });
});
