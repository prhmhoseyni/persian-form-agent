#!/usr/bin/env node

import { Command } from "commander";
import { bootstrap } from "../src/phases/bootstrap.js";
import { analyze } from "../src/phases/analyze.js";
import { implement } from "../src/phases/install.js";
import { runVerifySetup } from "../src/commands/verifySetup.js";

const program = new Command();

program
  .name("persian-form-agent")
  .description("CLI tool that uses Claude to generate React forms from Persian text descriptions")
  .version("0.1.0");

program
  .command("init")
  .description("Phase 0: Create agent.config.json in the target project")
  .option("-p, --path <path>", "Target project root path", ".")
  .action(async (options) => {
    try {
      await bootstrap(options.path);
    } catch (err) {
      console.error("Init failed:", err);
      process.exit(1);
    }
  });

program
  .command("analyze")
  .description("Phase 1: Analyze a Persian task description and produce an analysis file")
  .requiredOption("-i, --input <file>", "Path to the Persian task description text file")
  .option("-p, --path <path>", "Target project root path", ".")
  .option("--wizard", "Force wizard form type (overrides auto-detection)")
  .action(async (options) => {
    try {
      await analyze(options.input, options.path, { wizard: options.wizard });
    } catch (err) {
      console.error("Analyze failed:", err);
      process.exit(1);
    }
  });

program
  .command("implement <taskId>")
  .description("Phase 3: Install dependencies and generate form code for a task")
  .option("-p, --path <path>", "Target project root path", ".")
  .action(async (taskId, options) => {
    try {
      await implement(taskId, options.path);
    } catch (err) {
      console.error("Implement failed:", err);
      process.exit(1);
    }
  });

program
  .command("verify-setup")
  .description("Check that Tailwind v4 is properly configured in the project")
  .option("-p, --path <path>", "Target project root path", ".")
  .action((options) => {
    try {
      runVerifySetup(options.path);
    } catch (err) {
      console.error("Verify failed:", err);
      process.exit(1);
    }
  });

program.parse();
