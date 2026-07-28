import { describe, it, expect } from "vitest";
import {
  renderAnalysisMarkdown,
  parseAnalysisMarkdown,
} from "./analysisMarkdown.js";
import { computeOverallStatus } from "../types.js";
import type { AnalysisData } from "../types.js";

describe("renderAnalysisMarkdown", () => {
  it("renders a single-step form with one field", () => {
    const data: AnalysisData = {
      taskId: "1",
      formName: "TestForm",
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
              mappedValidators: ["required", "max:50"],
              rawRule: "فقط شامل کاراکتر فارسی",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    const md = renderAnalysisMarkdown(data);
    expect(md).toContain('taskId: "1"');
    expect(md).toContain("formType: single");
    expect(md).toContain("overallStatus: ready");
    expect(md).toContain("### Field: firstName");
    expect(md).toContain("- label: نام");
    expect(md).toContain("- required: true");
    expect(md).toContain("- mappedValidators: required, max:50");
    expect(md).toContain("- warnings: (none)");
  });

  it("renders a wizard form with step headers", () => {
    const data: AnalysisData = {
      taskId: "2",
      formName: "WizardForm",
      formType: "wizard",
      overallStatus: "needs-review",
      steps: [
        {
          stepIndex: 0,
          componentName: "StepOne",
          fields: [
            {
              name: "email",
              label: "ایمیل",
              required: true,
              nameSource: "auto-generated",
              mappedComponent: "Text",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required", "email"],
              rawRule: "ایمیل ضروری",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
        {
          stepIndex: 1,
          componentName: "StepTwo",
          fields: [
            {
              name: "phone",
              label: "تلفن",
              required: false,
              nameSource: "auto-generated",
              mappedComponent: "Cellphone",
              componentSource: "unresolved",
              componentStatus: "needs-decision",
              mappedValidators: [],
              rawRule: "شماره تلفن",
              confidence: "low",
              warnings: ["کامپوننت یافت نشد"],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    const md = renderAnalysisMarkdown(data);
    expect(md).toContain("## Step 0: StepOne");
    expect(md).toContain("## Step 1: StepTwo");
    expect(md).toContain("overallStatus: needs-review");
    expect(md).toContain("- confidence: low");
    expect(md).toContain("- warnings: کامپوننت یافت نشد");
  });

  it("renders customize block when present", () => {
    const data: AnalysisData = {
      taskId: "3",
      formName: "CustomForm",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "amount",
              label: "مبلغ",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Amount",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required"],
              rawRule: "مبلغ ضروری",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
              customize: "yup.string().test('positive', 'باید مثبت باشد', (v) => Number(v) > 0)",
            },
          ],
        },
      ],
    };

    const md = renderAnalysisMarkdown(data);
    expect(md).toContain("#### Customize (optional)");
    expect(md).toContain("```yup");
    expect(md).toContain("yup.string().test('positive'");
  });
});

describe("parseAnalysisMarkdown", () => {
  it("parses a single-step form", () => {
    const md = `---
taskId: "123"
formName: RegistrationForm
formType: single
overallStatus: needs-review
---

# Form: RegistrationForm

### Field: firstName
- label: نام
- required: true
- nameSource: explicit-in-task
- mappedComponent: Text
- componentSource: local
- componentStatus: resolved-local
- mappedValidators: trim, required, onlyPersianCharactersAndDigits, max:50
- rawRule: فقط شامل کاراکتر فارسی می‌شود
- confidence: high
- warnings: (none)
`;

    const data = parseAnalysisMarkdown(md);
    expect(data.taskId).toBe("123");
    expect(data.formName).toBe("RegistrationForm");
    expect(data.formType).toBe("single");
    expect(data.overallStatus).toBe("needs-review");
    expect(data.steps).toHaveLength(1);
    expect(data.steps[0].fields).toHaveLength(1);

    const field = data.steps[0].fields[0];
    expect(field.name).toBe("firstName");
    expect(field.label).toBe("نام");
    expect(field.required).toBe(true);
    expect(field.nameSource).toBe("explicit-in-task");
    expect(field.mappedComponent).toBe("Text");
    expect(field.componentSource).toBe("local");
    expect(field.componentStatus).toBe("resolved-local");
    expect(field.mappedValidators).toEqual([
      "trim",
      "required",
      "onlyPersianCharactersAndDigits",
      "max:50",
    ]);
    expect(field.confidence).toBe("high");
    expect(field.warnings).toEqual([]);
  });

  it("parses a wizard form with multiple steps", () => {
    const md = `---
taskId: "124"
formName: CreateDebtWizard
formType: wizard
overallStatus: ready
---

# Form: CreateDebtWizard

## Step 0: SelectPattern

### Field: unitType
- label: نوع واحد
- required: true
- nameSource: explicit-in-task
- mappedComponent: MultiSelect
- componentSource: react-persian-form
- componentStatus: needs-installation
- mappedValidators: required
- rawRule: انتخاب نوع واحد
- confidence: high
- warnings: (none)

## Step 1: BasicInfo

### Field: area
- label: متراژ
- required: true
- nameSource: auto-generated
- mappedComponent: Amount
- componentSource: react-persian-form
- componentStatus: needs-installation
- mappedValidators: required, min:1
- rawRule: متراژ ملک
- confidence: high
- warnings: (none)
`;

    const data = parseAnalysisMarkdown(md);
    expect(data.taskId).toBe("124");
    expect(data.formType).toBe("wizard");
    expect(data.overallStatus).toBe("ready");
    expect(data.steps).toHaveLength(2);

    expect(data.steps[0].stepIndex).toBe(0);
    expect(data.steps[0].componentName).toBe("SelectPattern");
    expect(data.steps[0].fields[0].name).toBe("unitType");

    expect(data.steps[1].stepIndex).toBe(1);
    expect(data.steps[1].componentName).toBe("BasicInfo");
    expect(data.steps[1].fields[0].name).toBe("area");
  });

  it("parses fields with warnings", () => {
    const md = `---
taskId: "125"
formName: WarnForm
formType: single
overallStatus: needs-review
---

# Form: WarnForm

### Field: comment
- label: نظر
- required: false
- nameSource: auto-generated
- mappedComponent: TextArea
- componentSource: unresolved
- componentStatus: needs-decision
- mappedValidators: min:5
- rawRule: حداقل ۵ کاراکتر
- confidence: low
- warnings: کامپوننت TextArea یافت نشد
`;

    const data = parseAnalysisMarkdown(md);
    expect(data.overallStatus).toBe("needs-review");
    const field = data.steps[0].fields[0];
    expect(field.warnings).toEqual(["کامپوننت TextArea یافت نشد"]);
    expect(field.confidence).toBe("low");
  });
});

describe("round-trip: parse(render(x)) === x", () => {
  it("round-trips a single-step form", () => {
    const original: AnalysisData = {
      taskId: "100",
      formName: "RoundTripForm",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "name",
              label: "نام",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Text",
              componentSource: "local",
              componentStatus: "resolved-local",
              mappedValidators: ["required", "max:100"],
              rawRule: "نام ضروری",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
            {
              name: "email",
              label: "ایمیل",
              required: false,
              nameSource: "auto-generated",
              mappedComponent: null,
              componentSource: "unresolved",
              componentStatus: "needs-decision",
              mappedValidators: ["email"],
              rawRule: "ایمیل اختیاری",
              confidence: "medium",
              warnings: ["کامپوننت یافت نشد"],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    const rendered = renderAnalysisMarkdown(original);
    const parsed = parseAnalysisMarkdown(rendered);

    expect(parsed.taskId).toBe(original.taskId);
    expect(parsed.formName).toBe(original.formName);
    expect(parsed.formType).toBe(original.formType);
    expect(parsed.overallStatus).toBe(original.overallStatus);
    expect(parsed.steps).toHaveLength(original.steps.length);

    for (let i = 0; i < parsed.steps.length; i++) {
      expect(parsed.steps[i].stepIndex).toBe(original.steps[i].stepIndex);
      expect(parsed.steps[i].fields).toHaveLength(
        original.steps[i].fields.length,
      );

      for (let j = 0; j < parsed.steps[i].fields.length; j++) {
        const pf = parsed.steps[i].fields[j];
        const of = original.steps[i].fields[j];
        expect(pf.name).toBe(of.name);
        expect(pf.label).toBe(of.label);
        expect(pf.required).toBe(of.required);
        expect(pf.nameSource).toBe(of.nameSource);
        expect(pf.mappedComponent).toBe(of.mappedComponent);
        expect(pf.componentSource).toBe(of.componentSource);
        expect(pf.componentStatus).toBe(of.componentStatus);
        expect(pf.mappedValidators).toEqual(of.mappedValidators);
        expect(pf.rawRule).toBe(of.rawRule);
        expect(pf.confidence).toBe(of.confidence);
        expect(pf.warnings).toEqual(of.warnings);
      }
    }
  });

  it("round-trips a wizard form", () => {
    const original: AnalysisData = {
      taskId: "200",
      formName: "WizardRoundTrip",
      formType: "wizard",
      overallStatus: "needs-review",
      steps: [
        {
          stepIndex: 0,
          componentName: "StepAlpha",
          fields: [
            {
              name: "field1",
              label: "فیلد اول",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Text",
              componentSource: "local",
              componentStatus: "resolved-local",
              mappedValidators: ["required"],
              rawRule: "قانون اول",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
        {
          stepIndex: 1,
          componentName: "StepBeta",
          fields: [
            {
              name: "field2",
              label: "فیلد دوم",
              required: false,
              nameSource: "auto-generated",
              mappedComponent: null,
              componentSource: "unresolved",
              componentStatus: "needs-decision",
              mappedValidators: [],
              rawRule: "قانون دوم",
              confidence: "low",
              warnings: ["هشدار"],
              customComponentPath: null,
            },
          ],
        },
      ],
    };

    const rendered = renderAnalysisMarkdown(original);
    const parsed = parseAnalysisMarkdown(rendered);

    expect(parsed.taskId).toBe(original.taskId);
    expect(parsed.formType).toBe("wizard");
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].componentName).toBe("StepAlpha");
    expect(parsed.steps[1].componentName).toBe("StepBeta");
    expect(parsed.steps[1].fields[0].warnings).toEqual(["هشدار"]);
  });

  it("round-trips a form with customize block", () => {
    const original: AnalysisData = {
      taskId: "300",
      formName: "CustomizeForm",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "amount",
              label: "مبلغ",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Amount",
              componentSource: "react-persian-form",
              componentStatus: "needs-installation",
              mappedValidators: ["required"],
              rawRule: "مبلغ ضروری",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
              customize: "yup.number().min(0)",
            },
          ],
        },
      ],
    };

    const rendered = renderAnalysisMarkdown(original);
    const parsed = parseAnalysisMarkdown(rendered);

    expect(parsed.steps[0].fields[0].customize).toBe("yup.number().min(0)");
  });
});

describe("computeOverallStatus", () => {
  it("returns ready when all fields are resolved with high confidence", () => {
    const data: AnalysisData = {
      taskId: "1",
      formName: "Test",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "x",
              label: "X",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Text",
              componentSource: "local",
              componentStatus: "resolved-local",
              mappedValidators: [],
              rawRule: "",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };
    expect(computeOverallStatus(data)).toBe("ready");
  });

  it("returns needs-review when a field has needs-decision", () => {
    const data: AnalysisData = {
      taskId: "2",
      formName: "Test",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "x",
              label: "X",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: null,
              componentSource: "unresolved",
              componentStatus: "needs-decision",
              mappedValidators: [],
              rawRule: "",
              confidence: "high",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };
    expect(computeOverallStatus(data)).toBe("needs-review");
  });

  it("returns needs-review when a field has low confidence", () => {
    const data: AnalysisData = {
      taskId: "3",
      formName: "Test",
      formType: "single",
      overallStatus: "ready",
      steps: [
        {
          stepIndex: 0,
          fields: [
            {
              name: "x",
              label: "X",
              required: true,
              nameSource: "explicit-in-task",
              mappedComponent: "Text",
              componentSource: "local",
              componentStatus: "resolved-local",
              mappedValidators: [],
              rawRule: "",
              confidence: "low",
              warnings: [],
              customComponentPath: null,
            },
          ],
        },
      ],
    };
    expect(computeOverallStatus(data)).toBe("needs-review");
  });
});
