import { describe, it, expect, beforeAll } from "vitest";
import { isLlmReachable, verifyLlmConnection } from "./verifyConnection.js";
import { resolveLlmConfig } from "../config/env.js";

/**
 * Integration test against a live LLM endpoint (FreeDeepseekAPI by default).
 * Auto-skips when the endpoint is unreachable so `npm test` stays green offline.
 * Point it elsewhere with LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
 */
describe("LLM endpoint integration", () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await isLlmReachable();
    if (!reachable) {
      const { baseURL } = resolveLlmConfig();
      console.warn(
        `[skip] LLM endpoint not reachable at ${baseURL} — start FreeDeepseekAPI to run this test.`,
      );
    }
  });

  it("responds to 'Say hello in Persian'", async () => {
    if (!reachable) return;

    const result = await verifyLlmConnection();

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.reply?.trim().length ?? 0).toBeGreaterThan(0);
  }, 30_000);
});
