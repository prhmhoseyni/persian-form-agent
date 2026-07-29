import fs from "node:fs";
import path from "node:path";
import { parseAnalysisMarkdown } from "../parsers/analysisMarkdown.js";
import type { AgentConfig } from "./bootstrap.js";
import { installComponents } from "./installComponents.js";
import { generateCode } from "./generateCode.js";
import { verifyTailwindSetup } from "../commands/verifySetup.js";

function loadConfig(projectRoot: string): AgentConfig {
  const configPath = path.join(projectRoot, "agent.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "agent.config.json not found. Run `ai-form-agent init` first.",
    );
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export async function implement(
  taskId: string,
  projectRoot: string,
): Promise<void> {
  const config = loadConfig(projectRoot);

  // Gate: verify Tailwind v4 setup before generating components
  const tailwindCheck = verifyTailwindSetup(projectRoot);
  if (!tailwindCheck.ok) {
    throw new Error(
      `Cannot implement: Tailwind v4 setup is incomplete.\n` +
        `Please add @import "tailwindcss" to your main CSS file, then run:\n` +
        `  npx ai-form-agent verify-setup`,
    );
  }

  // Read and parse the analysis file
  const analysisPath = path.join(projectRoot, `task-${taskId}.analysis.md`);
  if (!fs.existsSync(analysisPath)) {
    throw new Error(`Analysis file not found: ${analysisPath}`);
  }

  const mdContent = fs.readFileSync(analysisPath, "utf-8");
  const analysis = parseAnalysisMarkdown(mdContent);

  // Gate rule: refuse if overallStatus is not "ready"
  if (analysis.overallStatus !== "ready") {
    throw new Error(
      `Cannot implement: overallStatus is "${analysis.overallStatus}". ` +
        `Fix all needs-decision fields and low-confidence items, then set overallStatus to "ready".`,
    );
  }

  console.log(`Implementing task ${taskId} (${analysis.formType} form)...`);

  // Phase 3.1: Install components with needs-installation status
  await installComponents(analysis, config, projectRoot, taskId);

  // Phase 3.2: Generate code
  generateCode(analysis, config, projectRoot);

  console.log("Implementation complete.");
}
