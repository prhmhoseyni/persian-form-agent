export type FormType = "single" | "wizard";

export type OverallStatus = "ready" | "needs-review";

export type NameSource = "explicit-in-task" | "auto-generated";

export type ComponentSource =
  | "local"
  | "react-persian-form"
  | "project-custom"
  | "unresolved";

export type ComponentStatus =
  | "resolved-local"
  | "needs-installation"
  | "needs-decision"
  | "custom-confirmed";

export type Confidence = "high" | "medium" | "low";

export interface FormField {
  name: string;
  label: string;
  required: boolean;
  nameSource: NameSource;
  mappedComponent: string | null;
  componentSource: ComponentSource;
  componentStatus: ComponentStatus;
  mappedValidators: string[];
  rawRule: string;
  confidence: Confidence;
  warnings: string[];
  customComponentPath: string | null;
  customize?: string;
}

export interface WizardStep {
  stepIndex: number;
  componentName?: string;
  fields: FormField[];
}

export interface AnalysisData {
  taskId: string;
  formName: string;
  formType: FormType;
  overallStatus: OverallStatus;
  steps: WizardStep[];
}

export function computeOverallStatus(analysis: AnalysisData): OverallStatus {
  for (const step of analysis.steps) {
    for (const field of step.fields) {
      if (field.componentStatus === "needs-decision") {
        return "needs-review";
      }
      if (field.confidence === "low") {
        return "needs-review";
      }
    }
  }
  return "ready";
}
