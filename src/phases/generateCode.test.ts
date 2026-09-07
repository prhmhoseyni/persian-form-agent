import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateCode } from "./generateCode.js";
import type { AnalysisData } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "persian-form-agent-test-"));
}

const BASE_CONFIG: AgentConfig = {
  $schema: "",
  paths: {
    formComponents: "src/components/form/fields",
    formsOutput: "src/features/forms",
    customValidators: "src/utils/validation/yup-extensions.ts",
    utils: "src/utils",
    schemas: "src/schemas",
  },
  validationLibrary: "yup",
  cache: { path: ".cache/rpf-listing.json", ttlHours: 24 },
  reactPersianForm: {
    repoOwner: "prhmhoseyni",
    repoName: "react-persian-form",
    ref: "main",
  },
  wizardComponent: {
    importPath: "~/components/atoms/Wizard/Wizard",
    typesImportPath: "~/components/atoms/Wizard/Wizard.types",
  },
};

describe("generateCode - single-step form", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates a single-step form file and types", () => {
    const analysis: AnalysisData = {
      taskId: "123",
      formName: "RegistrationForm",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "firstName",
              label: "نام",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Text",
              componentSource: "local",
              componentStatus: "resolved-local",
              mappedValidators: ["trim", "required", "max:50"],
              rawRule: "فقط شامل کاراکتر فارسی",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
            {
              name: "cellphone",
              label: "شماره همراه",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Cellphone",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required", "cellPhoneNumber"],
              rawRule: "شماره همراه ضروری",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    generateCode(analysis, BASE_CONFIG, tmpDir);

    // Check form file exists
    const formFile = path.join(tmpDir, "src/features/forms/RegistrationForm.tsx");
    expect(fs.existsSync(formFile)).toBe(true);

    const content = fs.readFileSync(formFile, "utf-8");
    expect(content).toContain("export default function RegistrationForm()");
    expect(content).toContain("firstName");
    expect(content).toContain("cellphone");
    expect(content).toContain("useForm");
    expect(content).toContain("useYupValidationResolver");
    expect(content).toContain("yup.object");

    // components: named import (the generic, non-memo export), PascalCase
    // binding, path relative to formsOutput
    expect(content).toContain(
      'import { Text } from "../../components/form/fields/Text";',
    );
    expect(content).toContain(
      'import { Cellphone } from "../../components/form/fields/Cellphone";',
    );
    expect(content).toContain("<Text ");
    expect(content).toContain("<Cellphone ");
    expect(content).not.toContain('import { text }');
    // resolver comes from the installed validation bundle, not the Wizard path
    expect(content).toContain(
      'import { useYupValidationResolver } from "../../utils/validation/yup";',
    );
    // no stale React import (jsx: react-jsx)
    expect(content).not.toContain('from "react";');
    expect(content).toContain(".trim()");
    expect(content).toContain(".required()");
    expect(content).toContain(".max(50)");
    expect(content).toContain(".cellPhoneNumber()");
    expect(content).toContain('label="نام"');
    expect(content).toContain('label="شماره همراه"');

    // Check types file
    const typesFile = path.join(tmpDir, "src/schemas/RegistrationFormFormVo.ts");
    expect(fs.existsSync(typesFile)).toBe(true);
    const typesContent = fs.readFileSync(typesFile, "utf-8");
    expect(typesContent).toContain("export interface RegistrationFormFormVo");
    expect(typesContent).toContain("firstName: string");
    expect(typesContent).toContain("cellphone: string");
  });
});

describe("generateCode - wizard form", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates step files and parent wizard file", () => {
    const analysis: AnalysisData = {
      taskId: "124",
      formName: "CreateDebtWizard",
      formType: "wizard",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          componentName: "SelectPattern",
          fields: [
            {
              name: "unitType",
              label: "نوع واحد",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "MultiSelect",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required"],
              rawRule: "انتخاب نوع واحد",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
        {
          stepIndex: 1,
          componentName: "BasicInfo",
          fields: [
            {
              name: "area",
              label: "متراژ",
              required: true,
              nameSource: "auto-generated",
              mappedComponent: "Amount",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required", "min:1"],
              rawRule: "متراژ ملک",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    generateCode(analysis, BASE_CONFIG, tmpDir);

    // Check step files
    const step0 = path.join(tmpDir, "src/features/forms/SelectPattern.tsx");
    expect(fs.existsSync(step0)).toBe(true);
    const step0Content = fs.readFileSync(step0, "utf-8");
    expect(step0Content).toContain("export function SelectPattern");
    expect(step0Content).toContain(
      'import type { WizardStepProps } from "~/components/atoms/Wizard/Wizard.types";',
    );
    expect(step0Content).toContain("unitType");
    expect(step0Content).toContain("props.dispatch(values)");
    expect(step0Content).not.toContain('from "react";');

    const step1 = path.join(tmpDir, "src/features/forms/BasicInfo.tsx");
    expect(fs.existsSync(step1)).toBe(true);
    const step1Content = fs.readFileSync(step1, "utf-8");
    expect(step1Content).toContain("export function BasicInfo");
    expect(step1Content).toContain("area");

    // Check parent wizard file
    const parentFile = path.join(tmpDir, "src/features/forms/CreateDebtWizard.tsx");
    expect(fs.existsSync(parentFile)).toBe(true);
    const parentContent = fs.readFileSync(parentFile, "utf-8");
    expect(parentContent).toContain("import Wizard from");
    expect(parentContent).toContain("import { SelectPattern }");
    expect(parentContent).toContain("import { BasicInfo }");
    expect(parentContent).toContain("component: SelectPattern");
    expect(parentContent).toContain("component: BasicInfo");
    expect(parentContent).toContain("steps={[");

    // Check types file
    const typesFile = path.join(tmpDir, "src/schemas/CreateDebtWizardFormVo.ts");
    expect(fs.existsSync(typesFile)).toBe(true);
  });
});
