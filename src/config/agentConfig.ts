import fs from "node:fs";
import path from "node:path";
import type { AgentConfig } from "../phases/bootstrap.js";

/**
 * Filenames persian-form-agent reads/writes in the target project. Everything
 * it drops in the project root is prefixed `persian-form-agent.` so it is easy
 * to spot and `.gitignore`.
 */
export const CONFIG_FILENAME = "persian-form-agent.config.json";
export const INSTALLATION_LOG_FILENAME =
  "persian-form-agent.installation-log.json";
export const DEFAULT_CACHE_PATH = ".cache/persian-form-agent.rpf-listing.json";

/** Superseded name, still read (with a warning) so existing setups keep working. */
const LEGACY_CONFIG_FILENAME = "agent.config.json";

export const CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/prhmhoseyni/persian-form-agent/main/schemas/persian-form-agent.config.schema.json";

/** Absolute path to the config file, honouring the legacy name if that's what exists. */
export function resolveConfigPath(projectRoot: string): string {
  const current = path.join(projectRoot, CONFIG_FILENAME);
  if (fs.existsSync(current)) return current;

  const legacy = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
  if (fs.existsSync(legacy)) {
    console.warn(
      `⚠ Using legacy "${LEGACY_CONFIG_FILENAME}" — rename it to "${CONFIG_FILENAME}".`,
    );
    return legacy;
  }
  return current;
}

export function loadConfig(projectRoot: string): AgentConfig {
  const configPath = resolveConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `${CONFIG_FILENAME} not found. Run \`persian-form-agent init\` first.`,
    );
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}
