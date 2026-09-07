import fs from "node:fs";
import path from "node:path";
import { runToolLoop } from "../llm/client.js";
import { loadEnvFiles } from "../config/env.js";
import { ANALYZE_SYSTEM_PROMPT } from "../prompts/analyzeTaskPrompt.js";
import { ANALYZE_TOOLS } from "../tools/analyzeToolDefinitions.js";
import { createAnalyzeToolHandler } from "../tools/analyzeToolHandlers.js";
import type { AgentConfig } from "./bootstrap.js";

function loadConfig(projectRoot: string): AgentConfig {
  const configPath = path.join(projectRoot, "agent.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "agent.config.json not found. Run `persian-form-agent init` first.",
    );
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export async function analyze(
  inputFile: string,
  projectRoot: string,
  options: { wizard?: boolean },
): Promise<void> {
  // Load .env from the target project (and cwd) so ANTHROPIC_API_KEY is available
  loadEnvFiles(projectRoot);

  // Load config
  const config = loadConfig(projectRoot);

  // Read task description
  const taskPath = path.resolve(projectRoot, inputFile);
  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task file not found: ${taskPath}`);
  }
  const taskText = fs.readFileSync(taskPath, "utf-8");

  if (!taskText.trim()) {
    throw new Error("Task file is empty");
  }

  console.log(`Analyzing task from ${inputFile}...`);

  // Build user message with optional CLI hints
  let userMessage = taskText;
  if (options.wizard) {
    userMessage += "\n\n[CLI Hint: This should be a wizard/multi-step form]";
  }

  // Run LLM tool loop
  const toolHandler = createAnalyzeToolHandler(projectRoot, config);

  const result = await runToolLoop(
    ANALYZE_SYSTEM_PROMPT,
    userMessage,
    ANALYZE_TOOLS,
    toolHandler,
  );

  console.log("Analysis complete.");
  if (result) {
    console.log(result);
  }
}
