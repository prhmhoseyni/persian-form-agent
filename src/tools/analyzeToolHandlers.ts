import fs from "node:fs";
import path from "node:path";
import type { ToolHandler } from "../llm/client.js";
import { listLocalProjectComponents } from "./listLocalProjectComponents.js";
import { listReactPersianFormFiles } from "./listReactPersianFormFiles.js";
import { readComponentSource as readSource } from "./readComponentSource.js";
import type { AgentConfig } from "../phases/bootstrap.js";
import type { AnalysisData } from "../types.js";
import {
  renderAnalysisMarkdown,
  parseAnalysisMarkdown,
} from "../parsers/analysisMarkdown.js";
import { computeOverallStatus } from "../types.js";

export function createAnalyzeToolHandler(
  projectRoot: string,
  config: AgentConfig,
): ToolHandler {
  return async (
    name: string,
    input: Record<string, unknown>,
  ): Promise<string> => {
    switch (name) {
      case "listLocalProjectComponents": {
        const components = listLocalProjectComponents(
          projectRoot,
          config.paths.formComponents,
        );
        return JSON.stringify({ components });
      }

      case "listReactPersianFormFiles": {
        const category = input.category as
          | "components"
          | "validators"
          | "utils";
        const items = await listReactPersianFormFiles(
          projectRoot,
          config,
          category,
        );
        return JSON.stringify({ category, items });
      }

      case "readComponentSource": {
        const source = input.source as "local" | "react-persian-form";
        const filePath = input.filePath as string;
        const content = await readSource(source, filePath, {
          projectRoot,
          rpfConfig: config.reactPersianForm,
        });
        return JSON.stringify({ content });
      }

      case "writeAnalysisFile": {
        const analysis = input as unknown as AnalysisData;

        // Compute overallStatus automatically (gate rule)
        analysis.overallStatus = computeOverallStatus(analysis);

        const md = renderAnalysisMarkdown(analysis);
        const analysisPath = path.join(
          projectRoot,
          `task-${analysis.taskId}.analysis.md`,
        );
        fs.writeFileSync(analysisPath, md);

        return JSON.stringify({
          success: true,
          path: analysisPath,
          overallStatus: analysis.overallStatus,
          fieldCount: analysis.steps.reduce(
            (sum, s) => sum + s.fields.length,
            0,
          ),
        });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}
