import matter from "gray-matter";
import type {
  AnalysisData,
  WizardStep,
  FormField,
  FormType,
  OverallStatus,
  NameSource,
  ComponentSource,
  ComponentStatus,
  Confidence,
} from "../types.js";

function escapeYaml(value: string): string {
  if (/[:{}\[\],&*?|>!%#@`]/.test(value) || value === "") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function renderFieldValue(
  key: string,
  value: string | boolean | string[] | null,
): string {
  if (value === null || value === undefined) {
    return "- (none)";
  }
  if (typeof value === "boolean") {
    return `- ${key}: ${value}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `- ${key}: (none)`;
    }
    return `- ${key}: ${value.join(", ")}`;
  }
  return `- ${key}: ${escapeYaml(value)}`;
}

function renderField(field: FormField): string {
  const lines: string[] = [];
  lines.push(`### Field: ${field.name}`);
  lines.push(renderFieldValue("label", field.label));
  lines.push(renderFieldValue("required", field.required));
  lines.push(renderFieldValue("nameSource", field.nameSource));
  lines.push(renderFieldValue("mappedComponent", field.mappedComponent));
  lines.push(renderFieldValue("componentSource", field.componentSource));
  lines.push(renderFieldValue("componentStatus", field.componentStatus));
  lines.push(renderFieldValue("mappedValidators", field.mappedValidators));
  lines.push(renderFieldValue("rawRule", field.rawRule));
  lines.push(renderFieldValue("confidence", field.confidence));
  lines.push(renderFieldValue("warnings", field.warnings));

  if (field.customComponentPath) {
    lines.push(
      renderFieldValue("customComponentPath", field.customComponentPath),
    );
  }

  if (field.customize) {
    lines.push("");
    lines.push("#### Customize (optional)");
    lines.push("```yup");
    lines.push(field.customize);
    lines.push("```");
  }

  return lines.join("\n");
}

export function renderAnalysisMarkdown(data: AnalysisData): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`taskId: "${data.taskId}"`);
  lines.push(`formName: ${data.formName}`);
  lines.push(`formType: ${data.formType}`);
  lines.push(`overallStatus: ${data.overallStatus}`);
  lines.push("---");
  lines.push("");

  lines.push(`# Form: ${data.formName}`);
  lines.push("");

  for (const step of data.steps) {
    if (data.formType === "wizard") {
      lines.push(
        `## Step ${step.stepIndex}: ${step.componentName || `Step${step.stepIndex}`}`,
      );
      lines.push("");
    }

    for (const field of step.fields) {
      lines.push(renderField(field));
      lines.push("");
    }
  }

  return lines.join("\n");
}

const FIELD_KEYS = new Set([
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
]);

function parseFieldBlock(block: string): FormField {
  const field: FormField = {
    name: "",
    label: "",
    required: false,
    nameSource: "auto-generated",
    mappedComponent: null,
    componentSource: "unresolved",
    componentStatus: "needs-decision",
    mappedValidators: [],
    rawRule: "",
    confidence: "low",
    warnings: [],
    customComponentPath: null,
  };

  const lines = block.split("\n");
  let inCustomize = false;
  const customizeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#### Customize")) {
      inCustomize = true;
      continue;
    }
    if (inCustomize) {
      if (trimmed === "```") {
        inCustomize = false;
        continue;
      }
      if (trimmed.startsWith("```")) {
        continue; // opening fence like ```yup
      }
      customizeLines.push(line);
      continue;
    }

    // Match "- key: value" lines
    const kvMatch = trimmed.match(/^-\s+(\w+):\s+(.+)$/);
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    if (!FIELD_KEYS.has(key)) continue;

    switch (key) {
      case "label":
        field.label = value;
        break;
      case "required":
        field.required = value === "true";
        break;
      case "nameSource":
        field.nameSource = value as NameSource;
        break;
      case "mappedComponent":
        field.mappedComponent = value === "(none)" ? null : value;
        break;
      case "componentSource":
        field.componentSource = value as ComponentSource;
        break;
      case "componentStatus":
        field.componentStatus = value as ComponentStatus;
        break;
      case "mappedValidators":
        field.mappedValidators =
          value === "(none)" ? [] : value.split(", ").map((v) => v.trim());
        break;
      case "rawRule":
        field.rawRule = value;
        break;
      case "confidence":
        field.confidence = value as Confidence;
        break;
      case "warnings":
        field.warnings =
          value === "(none)" ? [] : value.split(", ").map((w) => w.trim());
        break;
      case "customComponentPath":
        field.customComponentPath = value === "(none)" ? null : value;
        break;
    }
  }

  if (customizeLines.length > 0) {
    field.customize = customizeLines.join("\n");
  }

  return field;
}

export function parseAnalysisMarkdown(content: string): AnalysisData {
  const { data: frontmatter, content: body } = matter(content);

  const steps: WizardStep[] = [];
  const hasStepHeaders = /^## Step /m.test(body);

  if (hasStepHeaders) {
    // Wizard form: split on ## Step headers, skip preamble before first step
    const stepSections = body.split(/^## Step /m);
    for (const section of stepSections) {
      const stepMatch = section.match(/^(\d+): (\S+)/);
      if (!stepMatch) continue; // skip preamble (e.g. "# Form: ..." heading)

      const stepIndex = parseInt(stepMatch[1], 10);
      const componentName = stepMatch[2];

      // Extract fields using regex for ### Field: headers
      const fieldNames: string[] = [];
      const fieldBlockMap = new Map<string, string>();

      // Split on ### Field: to get each field's block
      const parts = section.split(/^### Field: /m);
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        // The field name is on the first line
        const nameMatch = part.match(/^(\S+)/);
        if (!nameMatch) continue;
        const fieldName = nameMatch[1];
        fieldNames.push(fieldName);
        fieldBlockMap.set(fieldName, part);
      }

      const fields = fieldNames.map((name) => {
        const field = parseFieldBlock(fieldBlockMap.get(name)!);
        field.name = name;
        return field;
      });

      steps.push({ stepIndex, componentName, fields });
    }
  } else {
    // Single-step form: parse fields directly from body
    const fields: FormField[] = [];
    const parts = body.split(/^### Field: /m);
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const nameMatch = part.match(/^(\S+)/);
      if (!nameMatch) continue;
      const fieldName = nameMatch[1];
      const field = parseFieldBlock(part);
      field.name = fieldName;
      fields.push(field);
    }

    if (fields.length > 0) {
      steps.push({ stepIndex: 0, fields });
    }
  }

  return {
    taskId: frontmatter.taskId || "",
    formName: frontmatter.formName || "",
    formType: (frontmatter.formType as FormType) || "single",
    overallStatus:
      (frontmatter.overallStatus as OverallStatus) || "needs-review",
    steps,
  };
}
