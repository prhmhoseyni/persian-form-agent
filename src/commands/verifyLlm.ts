import { loadEnvFiles } from "../config/env.js";
import { verifyLlmConnection } from "../llm/verifyConnection.js";

/**
 * `persian-form-agent verify-llm` — smoke-test the configured LLM endpoint.
 * Loads `.env` from the target project, calls the endpoint with a fixed prompt,
 * and prints the reply. Exits non-zero on failure.
 */
export async function runVerifyLlm(projectRoot: string): Promise<void> {
  loadEnvFiles(projectRoot);

  const result = await verifyLlmConnection();

  console.log(`Endpoint: ${result.baseURL}`);
  console.log(`Model:    ${result.model}`);
  if (result.models && result.models.length > 0) {
    console.log(`Available models: ${result.models.join(", ")}`);
  }

  if (result.ok) {
    console.log("\n✔ LLM endpoint is reachable and responding.");
    console.log(`\nPrompt: "Say hello in Persian."`);
    console.log(`Reply:  ${result.reply?.trim()}`);
    return;
  }

  console.error(`\n✖ Could not get a valid response from the LLM endpoint.`);
  console.error(`  ${result.error ?? "Unknown error"}`);
  console.error(
    `\nIs FreeDeepseekAPI running at ${result.baseURL}?\n` +
      `  - Start it, then re-run: npx persian-form-agent verify-llm\n` +
      `  - Override the target with LLM_BASE_URL / LLM_MODEL / LLM_API_KEY`,
  );
  process.exit(1);
}
