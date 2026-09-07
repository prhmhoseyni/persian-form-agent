import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Load `.env` files into `process.env` without clobbering variables that are
 * already set. Looks in the target project root first, then the current
 * working directory.
 */
export function loadEnvFiles(projectRoot: string): void {
  const candidates = [
    path.resolve(projectRoot, ".env"),
    path.resolve(process.cwd(), ".env"),
  ];
  const seen = new Set<string>();
  for (const file of candidates) {
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const [k, v] of Object.entries(parseEnvFile(file))) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

/** Resolved LLM connection settings. */
export interface LlmConfig {
  /**
   * Base URL of an Anthropic-Messages-compatible endpoint. The Anthropic SDK
   * appends `/v1/messages`, so this must be the server origin only.
   */
  baseURL: string;
  /**
   * API key sent as `x-api-key`. The local FreeDeepseekAPI server ignores it,
   * so any non-empty string works.
   */
  apiKey: string;
  /** Model identifier passed on every request. */
  model: string;
}

/** Default: a locally running FreeDeepseekAPI server, no billing required. */
export const DEFAULT_LLM_BASE_URL = "http://127.0.0.1:9655";
export const DEFAULT_LLM_MODEL = "deepseek-chat";
export const DEFAULT_LLM_API_KEY = "dummy";

/**
 * Resolve LLM settings from the environment.
 *
 * `LLM_*` is the single source of truth. Ambient `ANTHROPIC_*` variables are
 * deliberately ignored so the CLI stays local-by-default even in shells that
 * have them set. Nothing is required — with no configuration at all the CLI
 * targets the local FreeDeepseekAPI server. To use the real Anthropic API, set
 * `LLM_BASE_URL=https://api.anthropic.com`, `LLM_API_KEY=sk-ant-...`, and an
 * appropriate `LLM_MODEL`.
 */
export function resolveLlmConfig(): LlmConfig {
  const baseURL = process.env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY || DEFAULT_LLM_API_KEY;
  const model = process.env.LLM_MODEL || DEFAULT_LLM_MODEL;

  return { baseURL: baseURL.replace(/\/+$/, ""), apiKey, model };
}
