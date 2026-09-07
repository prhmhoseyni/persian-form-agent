import { resolveLlmConfig } from "../config/env.js";
import { simpleCompletion } from "./client.js";

export interface VerifyLlmResult {
  ok: boolean;
  baseURL: string;
  model: string;
  /** Models advertised by `GET /v1/models`, when reachable. */
  models?: string[];
  /** The model's reply to the smoke-test prompt, when the round-trip succeeds. */
  reply?: string;
  error?: string;
}

const SMOKE_TEST_PROMPT = "Say hello in Persian.";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Is the configured endpoint reachable at all? Cheap `GET /v1/models` probe. */
export async function isLlmReachable(timeoutMs = 2000): Promise<boolean> {
  const { baseURL } = resolveLlmConfig();
  try {
    const res = await fetchWithTimeout(
      `${baseURL}/v1/models`,
      { method: "GET" },
      timeoutMs,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Full verification: list models, then do one real completion round-trip with
 * `SMOKE_TEST_PROMPT`. Never throws — failures come back on `result.error`.
 */
export async function verifyLlmConnection(): Promise<VerifyLlmResult> {
  const { baseURL, model } = resolveLlmConfig();
  const result: VerifyLlmResult = { ok: false, baseURL, model };

  try {
    const res = await fetchWithTimeout(
      `${baseURL}/v1/models`,
      { method: "GET" },
      5000,
    );
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ id?: string }> };
      result.models = (body.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === "string");
    }
  } catch {
    // Non-fatal: some shims don't implement /v1/models. Keep going.
  }

  try {
    const reply = await simpleCompletion(SMOKE_TEST_PROMPT);
    result.reply = reply;
    result.ok = reply.trim().length > 0;
    if (!result.ok) {
      result.error = "Endpoint responded but returned no text content.";
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
