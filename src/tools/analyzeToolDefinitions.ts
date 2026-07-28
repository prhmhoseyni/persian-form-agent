import type { ToolDefinition } from "../llm/client.js";

export const ANALYZE_TOOLS: ToolDefinition[] = [
  {
    name: "listLocalProjectComponents",
    description:
      "Returns the list of form component files found in the target project's paths.formComponents directory",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "listReactPersianFormFiles",
    description:
      "Returns the list of files in a given category (components/validators/utils) from the react-persian-form repo, using the local cache if fresh, otherwise fetching live from GitHub and refreshing the cache",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string" as const,
          enum: ["components", "validators", "utils"],
        },
      },
      required: ["category"],
    },
  },
  {
    name: "readComponentSource",
    description:
      "Reads the raw content of a specific component/validator/util file, either from the local project or from react-persian-form (via raw.githubusercontent.com), to inspect its props/signature/imports before committing to a match",
    input_schema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string" as const,
          enum: ["local", "react-persian-form"],
        },
        filePath: { type: "string" as const },
      },
      required: ["source", "filePath"],
    },
  },
  {
    name: "writeAnalysisFile",
    description:
      "Writes the final task-{id}.analysis.md file after rendering the structured analysis data through the deterministic markdown renderer",
    input_schema: {
      type: "object" as const,
      properties: {
        taskId: { type: "string" as const },
        formName: { type: "string" as const },
        formType: {
          type: "string" as const,
          enum: ["single", "wizard"],
        },
        steps: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              stepIndex: { type: "number" as const },
              componentName: { type: "string" as const },
              fields: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    name: { type: "string" as const },
                    label: { type: "string" as const },
                    required: { type: "boolean" as const },
                    nameSource: {
                      type: "string" as const,
                      enum: ["explicit-in-task", "auto-generated"],
                    },
                    mappedComponent: { type: ["string", "null"] as any },
                    componentSource: {
                      type: "string" as const,
                      enum: [
                        "local",
                        "react-persian-form",
                        "project-custom",
                        "unresolved",
                      ],
                    },
                    componentStatus: {
                      type: "string" as const,
                      enum: [
                        "resolved-local",
                        "needs-installation",
                        "needs-decision",
                        "custom-confirmed",
                      ],
                    },
                    mappedValidators: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    rawRule: { type: "string" as const },
                    confidence: {
                      type: "string" as const,
                      enum: ["high", "medium", "low"],
                    },
                    warnings: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    customComponentPath: {
                      type: ["string", "null"] as any,
                    },
                    customize: { type: "string" as const },
                  },
                  required: [
                    "name",
                    "label",
                    "required",
                    "nameSource",
                    "mappedComponent",
                    "componentSource",
                    "componentStatus",
                    "mappedValidators",
                    "rawRule",
                    "confidence",
                    "warnings",
                    "customComponentPath",
                  ],
                },
              },
            },
            required: ["stepIndex", "fields"],
          },
        },
      },
      required: ["taskId", "formName", "formType", "steps"],
    },
  },
];
