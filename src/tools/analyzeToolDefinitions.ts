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
      "Returns the available items in a given category from the react-persian-form component registry (registry/registry.json), using the local cache if fresh otherwise fetching from raw.githubusercontent.com. Each item is { name, description, files } where `name` is what you should put in `mappedComponent`/`mappedValidators` and `files` are paths (relative to the repo's templates/ dir) you can pass to readComponentSource. `components` lists field-input components (e.g. text, cellphone, amount); `validators` and `utils` list one item per source file with a camelCase name (e.g. cellPhoneNumber, onlyPersianCharactersAndDigits, toPersianDigits).",
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
      "Reads the raw content of a specific file to inspect its props/signature/imports before committing to a match. For source \"react-persian-form\", pass one of the `files` paths returned by listReactPersianFormFiles (e.g. \"components/text/text.tsx\", \"validation/yup/cell-phone-number.ts\"); the templates/ prefix is optional. For source \"local\", pass a path relative to the target project root.",
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
