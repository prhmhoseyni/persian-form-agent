import fs from "node:fs";
import path from "node:path";
import type { AnalysisData, FormField, WizardStep } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";
import { validationBundleDir } from "./installComponents.js";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** `text` → `Text`, `cell-phone` → `CellPhone`; already-cased names pass through. */
function toPascalCase(input: string): string {
  return input.replace(
    /(^|[-_/\s])([a-z0-9])/g,
    (_, __, c: string) => c.toUpperCase(),
  );
}

/** A `./`- or `../`-prefixed posix import specifier from `fromDir` to `toPath`. */
function relImport(fromDir: string, toPath: string): string {
  let rel = path.posix.relative(toPosix(fromDir), toPosix(toPath));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

/** JSX/import binding name for a field's component. */
function componentBinding(field: FormField): string {
  return toPascalCase(field.mappedComponent as string);
}

/**
 * `{ binding → import specifier }` for every mapped component in `fields`.
 * Components resolve to `<formComponents>/<name>` — the react-persian-form
 * registry lays each one out as `<name>/index.ts` that re-exports both a
 * `memo()`-wrapped default and the raw generic under its PascalCase name. We
 * import the **named** one: `memo()` erases the `<T extends FieldValues>`
 * parameter, so the default export won't accept a typed `Control<FormVo>`.
 */
function componentImports(
  fields: FormField[],
  config: AgentConfig,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const field of fields) {
    if (!field.mappedComponent) continue;
    out.set(
      componentBinding(field),
      field.customComponentPath ??
        relImport(
          config.paths.formsOutput,
          path.posix.join(
            toPosix(config.paths.formComponents),
            field.mappedComponent,
          ),
        ),
    );
  }
  return out;
}

function renderComponentImports(imports: Map<string, string>): string[] {
  return [...imports].map(
    ([name, spec]) => `import { ${name} } from "${spec}";`,
  );
}

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
  return `<${componentBinding(field)} label="${field.label}" name="${field.name}" control={formMethods.control} />`;
}

function generateSingleStepForm(
  analysis: AnalysisData,
  config: AgentConfig,
): string {
  const step = analysis.steps[0];
  const fields = step.fields;

  const resolverImport = relImport(
    config.paths.formsOutput,
    validationBundleDir(config),
  );

  const imports = [
    `import { useForm } from "react-hook-form";`,
    `import { useYupValidationResolver } from "${resolverImport}";`,
    `import * as yup from "yup";`,
    ...renderComponentImports(componentImports(fields, config)),
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

  const resolverImport = relImport(
    config.paths.formsOutput,
    validationBundleDir(config),
  );

  const imports = [
    `import { useForm } from "react-hook-form";`,
    `import { useYupValidationResolver } from "${resolverImport}";`,
    `import type { WizardStepProps } from "${config.wizardComponent.typesImportPath}";`,
    `import * as yup from "yup";`,
    ...renderComponentImports(componentImports(fields, config)),
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

  return `import Wizard from "${config.wizardComponent.importPath}";

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
