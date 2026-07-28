import fs from "node:fs";
import path from "node:path";
import type { AnalysisData, FormField, WizardStep } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";

function buildYupValidatorChain(field: FormField): string {
  const parts: string[] = [];
  parts.push("yup.string()");

  for (const validator of field.mappedValidators) {
    if (validator === "required") {
      parts.push(".required()");
    } else if (validator === "trim") {
      parts.push(".trim()");
    } else if (validator.startsWith("max:")) {
      const n = validator.split(":")[1];
      parts.push(`.max(${n})`);
    } else if (validator.startsWith("min:")) {
      const n = validator.split(":")[1];
      parts.push(`.min(${n})`);
    } else if (validator === "onlyPersianCharactersAndDigits") {
      parts.push(".onlyPersianCharactersAndDigits()");
    } else if (validator === "cellPhoneNumber") {
      parts.push(".cellPhoneNumber()");
    } else if (validator === "email") {
      parts.push(".email()");
    } else if (validator.startsWith("space:")) {
      const n = validator.split(":")[1];
      parts.push(`.space(${n})`);
    } else if (validator.startsWith("halfSpace:")) {
      const n = validator.split(":")[1];
      parts.push(`.halfSpace(${n})`);
    } else {
      // Unknown validator — use as-is
      parts.push(`.${validator}()`);
    }
  }

  if (!field.required) {
    // Remove .required() if present, make optional
    const idx = parts.indexOf(".required()");
    if (idx !== -1) parts.splice(idx, 1);
  }

  return parts.join("");
}

function buildDefaultValues(fields: FormField[]): string {
  const entries = fields.map((f) => `    ${f.name}: undefined`);
  return entries.join(",\n");
}

function buildComponentJsx(field: FormField): string {
  if (!field.mappedComponent) {
    return `{/* TODO: ${field.name} — component unresolved */}`;
  }
  return `<${field.mappedComponent} label="${field.label}" name="${field.name}" control={formMethods.control} />`;
}

function generateSingleStepForm(
  analysis: AnalysisData,
  config: AgentConfig,
): string {
  const step = analysis.steps[0];
  const fields = step.fields;

  // Collect imports
  const componentImports = new Set<string>();
  for (const field of fields) {
    if (field.mappedComponent) {
      componentImports.add(field.mappedComponent);
    }
  }

  const imports = [
    `import React from "react";`,
    `import { useForm } from "react-hook-form";`,
    `import { useYupValidationResolver } from "${config.wizardComponent.importPath.replace(/Wizard$/, "useYupValidationResolver")}";`,
    `import * as yup from "yup";`,
    ...Array.from(componentImports).map(
      (c) => `import { ${c} } from "${config.paths.formComponents}/${c}";`,
    ),
  ];

  // Build yup schema
  const schemaEntries = fields.map(
    (f) => `    ${f.name}: ${buildYupValidatorChain(f)},`,
  );

  // Build JSX
  const jsxFields = fields.map((f) => `      ${buildComponentJsx(f)}`);

  const formVoType = `${analysis.formName}FormVo`;

  return `${imports.join("\n")}

interface ${formVoType} {
${fields.map((f) => `  ${f.name}: string;`).join("\n")}
}

export default function ${analysis.formName}() {
  const resolver = useYupValidationResolver(
    yup.object({
${schemaEntries.join("\n")}
    })
  );

  const formMethods = useForm<${formVoType}>({
    defaultValues: {
${buildDefaultValues(fields)}
    },
    resolver,
  });

  const onSubmit = formMethods.handleSubmit((values) => {
    console.log("Form submitted:", values);
  });

  return (
    <form id="${analysis.formName}" onSubmit={onSubmit}>
${jsxFields.join("\n")}
    </form>
  );
}
`;
}

function generateWizardStep(
  step: WizardStep,
  analysis: AnalysisData,
  config: AgentConfig,
): { fileName: string; content: string } {
  const componentName =
    step.componentName || `${analysis.formName}Step${step.stepIndex}`;
  const fields = step.fields;

  const componentImports = new Set<string>();
  for (const field of fields) {
    if (field.mappedComponent) {
      componentImports.add(field.mappedComponent);
    }
  }

  const imports = [
    `import React from "react";`,
    `import { useForm } from "react-hook-form";`,
    `import { useYupValidationResolver } from "${config.wizardComponent.importPath.replace(/Wizard$/, "useYupValidationResolver")}";`,
    `import { WizardStepProps } from "${config.wizardComponent.typesImportPath}";`,
    `import * as yup from "yup";`,
    ...Array.from(componentImports).map(
      (c) => `import { ${c } } from "${config.paths.formComponents}/${c}";`,
    ),
  ];

  const formVoType = `${analysis.formName}FormVo`;
  const schemaEntries = fields.map(
    (f) => `    ${f.name}: ${buildYupValidatorChain(f)},`,
  );
  const jsxFields = fields.map((f) => `      ${buildComponentJsx(f)}`);

  const content = `${imports.join("\n")}

interface ${formVoType} {
${fields.map((f) => `  ${f.name}: string;`).join("\n")}
}

export function ${componentName}(props: WizardStepProps<${formVoType}>) {
  const resolver = useYupValidationResolver(
    yup.object({
${schemaEntries.join("\n")}
    })
  );

  const formMethods = useForm<${formVoType}>({
    defaultValues: props.data || {},
    resolver,
  });

  const onSubmit = formMethods.handleSubmit((values) => {
    props.dispatch(values);
  });

  return (
    <form id="${componentName}" onSubmit={onSubmit}>
${jsxFields.join("\n")}
      <button type="submit">ادامه</button>
    </form>
  );
}
`;

  return { fileName: `${componentName}.tsx`, content };
}

function generateWizardParent(
  analysis: AnalysisData,
  config: AgentConfig,
): string {
  const stepImports = analysis.steps.map((step, i) => {
    const name =
      step.componentName || `${analysis.formName}Step${step.stepIndex}`;
    return `import { ${name} } from "./${name}";`;
  });

  const stepEntries = analysis.steps.map((step, i) => {
    const name =
      step.componentName || `${analysis.formName}Step${step.stepIndex}`;
    return `    { component: ${name} }`;
  });

  return `import React from "react";
import Wizard from "${config.wizardComponent.importPath}";

${stepImports.join("\n")}

export default function ${analysis.formName}() {
  const onSubmit = (data: any) => {
    console.log("Wizard completed:", data);
  };

  return (
    <Wizard
      defaultValues={{}}
      steps={[
${stepEntries.join(",\n")}
      ]}
      onSubmit={onSubmit}
    />
  );
}
`;
}

export function generateCode(
  analysis: AnalysisData,
  config: AgentConfig,
  projectRoot: string,
): void {
  const outputDir = path.join(projectRoot, config.paths.formsOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (analysis.formType === "single") {
    const content = generateSingleStepForm(analysis, config);
    const filePath = path.join(outputDir, `${analysis.formName}.tsx`);
    fs.writeFileSync(filePath, content);
    console.log(`Generated: ${path.relative(projectRoot, filePath)}`);
  } else {
    // Wizard form: generate one file per step + parent
    for (const step of analysis.steps) {
      const { fileName, content } = generateWizardStep(
        step,
        analysis,
        config,
      );
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, content);
      console.log(`Generated step: ${path.relative(projectRoot, filePath)}`);
    }

    const parentContent = generateWizardParent(analysis, config);
    const parentPath = path.join(outputDir, `${analysis.formName}.tsx`);
    fs.writeFileSync(parentPath, parentContent);
    console.log(
      `Generated wizard: ${path.relative(projectRoot, parentPath)}`,
    );
  }

  // Generate form type interface in schemas dir
  const schemaDir = path.join(projectRoot, config.paths.schemas);
  if (!fs.existsSync(schemaDir)) {
    fs.mkdirSync(schemaDir, { recursive: true });
  }

  const allFields = analysis.steps.flatMap((s) => s.fields);
  const interfaceContent = `export interface ${analysis.formName}FormVo {
${allFields.map((f) => `  ${f.name}: string;`).join("\n")}
}
`;
  const schemaPath = path.join(schemaDir, `${analysis.formName}FormVo.ts`);
  fs.writeFileSync(schemaPath, interfaceContent);
  console.log(
    `Generated types: ${path.relative(projectRoot, schemaPath)}`,
  );
}
