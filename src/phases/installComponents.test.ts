import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AnalysisData, FormField } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";
import type { RegistryEntry } from "../tools/reactPersianFormRegistry.js";

// ---- mocks -----------------------------------------------------------------

const fetchRegistryMock = vi.fn<[], Promise<RegistryEntry[]>>();
const readComponentSourceMock = vi.fn<
  [string, string, unknown?],
  Promise<string>
>();

vi.mock("../tools/reactPersianFormRegistry.js", () => ({
  REGISTRY_PATH: "registry/registry.json",
  TEMPLATES_DIR: "templates",
  fetchRegistry: (...args: unknown[]) => fetchRegistryMock(...(args as [])),
}));

vi.mock("../tools/readComponentSource.js", () => ({
  readComponentSource: (...args: unknown[]) =>
    readComponentSourceMock(...(args as [string, string, unknown?])),
}));

const {
  installComponents,
  collectRegistryKeys,
  resolveTransitiveKeys,
  resolveLocalLayout,
  mapTemplatePathToLocal,
  rewriteRelativeImports,
} = await import("./installComponents.js");

// ---- fixtures -------------------------------------------------------------

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "persian-form-agent-install-"));
}

const CONFIG: AgentConfig = {
  $schema: "",
  paths: {
    formComponents: "src/components/form/fields",
    formsOutput: "src/features/forms",
    customValidators: "src/utils/validation/yup-extensions.ts",
    utils: "src/utils",
    schemas: "src/schemas",
  },
  importAlias: null,
  validationLibrary: "yup",
  cache: { path: ".cache/persian-form-agent.rpf-listing.json", ttlHours: 24 },
  reactPersianForm: {
    repoOwner: "prhmhoseyni",
    repoName: "react-persian-form",
    ref: "main",
  },
  wizardComponent: {
    importPath: "~/components/wizard/Wizard",
    typesImportPath: "~/components/wizard/Wizard.types",
  },
};

const REGISTRY: RegistryEntry[] = [
  {
    key: "utils",
    type: "utils",
    description: "helpers",
    files: ["utils/to-persian-digits.ts", "utils/is-valid-mobile.ts", "utils/index.ts"],
    dependencies: [],
    registryDependencies: [],
  },
  {
    key: "component-core",
    type: "component-core",
    description: "core input",
    files: ["components/_core/formatter.ts", "components/_core/input.tsx"],
    dependencies: ["clsx", "react-hook-form"],
    registryDependencies: [],
  },
  {
    key: "validation-yup",
    type: "validation",
    description: "yup methods",
    files: ["validation/yup/cell-phone-number.ts", "validation/yup/index.ts"],
    dependencies: ["yup", "@hookform/resolvers"],
    registryDependencies: ["utils"],
  },
  {
    key: "text",
    type: "component",
    description: "text input",
    files: ["components/text/text.tsx", "components/text/index.ts"],
    dependencies: ["react-hook-form"],
    registryDependencies: ["utils", "component-core"],
  },
  {
    key: "cellphone",
    type: "component",
    description: "cellphone input",
    files: ["components/cellphone/cellphone.tsx", "components/cellphone/index.ts"],
    dependencies: ["react-hook-form"],
    registryDependencies: ["utils", "component-core"],
  },
];

const FILES: Record<string, string> = {
  "components/text/text.tsx": [
    `import { toPersianDigits } from "../../utils/to-persian-digits";`,
    `import type { Formatter } from "../_core/formatter";`,
    `import { Input } from "../_core/input";`,
    `export function Text() { return null; }`,
  ].join("\n"),
  "components/text/index.ts": `export { Text } from "./text";`,
  "components/cellphone/cellphone.tsx": [
    `import { toPersianDigits } from "../../utils/to-persian-digits";`,
    `import { Input } from "../_core/input";`,
    `export function Cellphone() { return null; }`,
  ].join("\n"),
  "components/cellphone/index.ts": `export { Cellphone } from "./cellphone";`,
  "components/_core/formatter.ts": `export interface Formatter { x: number }`,
  "components/_core/input.tsx": `import type { Formatter } from "./formatter";\nexport function Input() { return null; }`,
  "utils/to-persian-digits.ts": `export function toPersianDigits(v: string) { return v; }`,
  "utils/is-valid-mobile.ts": `export function isValidMobile(v: string) { return true; }`,
  "utils/index.ts": `export { toPersianDigits } from "./to-persian-digits";`,
  "validation/yup/cell-phone-number.ts": [
    `import * as yup from "yup";`,
    `import { isValidMobile } from "../../utils/is-valid-mobile";`,
    `export {};`,
  ].join("\n"),
  "validation/yup/index.ts": `import "./cell-phone-number";\nexport default {};`,
};

function field(overrides: Partial<FormField>): FormField {
  return {
    name: "f",
    label: "L",
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
    ...overrides,
  };
}

function analysisWith(fields: FormField[]): AnalysisData {
  return {
    taskId: "42",
    formName: "RegistrationForm",
    formType: "single",
    overallStatus: "ready",
    steps: [{ stepIndex: 0, fields }],
  };
}

beforeEach(() => {
  fetchRegistryMock.mockReset();
  readComponentSourceMock.mockReset();
  fetchRegistryMock.mockResolvedValue(REGISTRY);
  readComponentSourceMock.mockImplementation(async (_src, file) => {
    if (!(file in FILES)) throw new Error(`unexpected fetch: ${file}`);
    return FILES[file];
  });
});

// ---- pure helpers --------------------------------------------------------

describe("resolveLocalLayout", () => {
  it("derives validation dir from the customValidators file's parent", () => {
    expect(resolveLocalLayout(CONFIG)).toEqual({
      components: "src/components/form/fields",
      validation: "src/utils/validation",
      utils: "src/utils",
    });
  });
});

describe("mapTemplatePathToLocal", () => {
  const layout = resolveLocalLayout(CONFIG);

  it("maps each known prefix to its configured dir", () => {
    expect(mapTemplatePathToLocal("components/text/text.tsx", layout)).toBe(
      "src/components/form/fields/text/text.tsx",
    );
    expect(
      mapTemplatePathToLocal("validation/yup/cell-phone-number.ts", layout),
    ).toBe("src/utils/validation/yup/cell-phone-number.ts");
    expect(mapTemplatePathToLocal("utils/to-persian-digits.ts", layout)).toBe(
      "src/utils/to-persian-digits.ts",
    );
  });

  it("tolerates a leading templates/ prefix and back-slashes", () => {
    expect(
      mapTemplatePathToLocal("templates\\components\\text\\index.ts", layout),
    ).toBe("src/components/form/fields/text/index.ts");
  });

  it("returns null for prefixes we don't install", () => {
    expect(mapTemplatePathToLocal("theme/persian-form-theme.css", layout)).toBeNull();
    expect(mapTemplatePathToLocal("README.md", layout)).toBeNull();
  });
});

describe("rewriteRelativeImports", () => {
  const layout = resolveLocalLayout(CONFIG);

  it("repoints cross-prefix imports (component -> utils) and leaves intra-prefix ones", () => {
    const out = rewriteRelativeImports(
      FILES["components/text/text.tsx"],
      "components/text/text.tsx",
      layout,
    );
    expect(out).toContain(
      `from "../../../../utils/to-persian-digits"`,
    );
    // sibling _core import is unchanged
    expect(out).toContain(`from "../_core/formatter"`);
    expect(out).toContain(`from "../_core/input"`);
  });

  it("repoints validator -> utils imports", () => {
    const out = rewriteRelativeImports(
      FILES["validation/yup/cell-phone-number.ts"],
      "validation/yup/cell-phone-number.ts",
      layout,
    );
    expect(out).toContain(`from "../../is-valid-mobile"`);
    expect(out).toContain(`import * as yup from "yup"`); // untouched
  });

  it("leaves side-effect imports within the same prefix alone", () => {
    const out = rewriteRelativeImports(
      FILES["validation/yup/index.ts"],
      "validation/yup/index.ts",
      layout,
    );
    expect(out).toContain(`import "./cell-phone-number"`);
  });

  it("rewrites every mapped import to the alias when one is given", () => {
    const out = rewriteRelativeImports(
      FILES["components/text/text.tsx"],
      "components/text/text.tsx",
      layout,
      { prefix: "~", base: "src" },
    );
    expect(out).toContain(`from "~/utils/to-persian-digits"`);
    expect(out).toContain(`from "~/components/form/fields/_core/formatter"`);
    expect(out).not.toContain("../");
  });
});

describe("collectRegistryKeys", () => {
  it("collects the mapped component key plus the validation bundle", () => {
    const { rootKeys, warnings } = collectRegistryKeys(
      analysisWith([
        field({
          name: "firstName",
          mappedComponent: "text",
          componentSource: "react-persian-form",
          componentStatus: "needs-installation",
        }),
      ]),
      REGISTRY,
      "yup",
    );
    expect(rootKeys.sort()).toEqual(["text", "validation-yup"]);
    expect(warnings).toEqual([]);
  });

  it("matches the component key case-insensitively", () => {
    const { rootKeys } = collectRegistryKeys(
      analysisWith([
        field({
          mappedComponent: "Text",
          componentSource: "react-persian-form",
          componentStatus: "needs-installation",
        }),
      ]),
      REGISTRY,
      "yup",
    );
    expect(rootKeys).toContain("text");
  });

  it("always installs the validation bundle for a form with fields (locale + resolver live there)", () => {
    const { rootKeys } = collectRegistryKeys(
      analysisWith([
        field({
          mappedComponent: "text",
          componentSource: "local",
          componentStatus: "resolved-local",
          mappedValidators: ["required", "trim", "max:50"],
        }),
      ]),
      REGISTRY,
      "yup",
    );
    expect(rootKeys).toEqual(["validation-yup"]);
  });

  it("collects nothing for an analysis with no fields", () => {
    const { rootKeys } = collectRegistryKeys(
      { taskId: "x", formName: "X", formType: "single", overallStatus: "ready", steps: [] },
      REGISTRY,
      "yup",
    );
    expect(rootKeys).toEqual([]);
  });

  it("warns and skips when the component is not in the registry", () => {
    const { rootKeys, warnings } = collectRegistryKeys(
      analysisWith([
        field({
          name: "birthDate",
          mappedComponent: "datepicker",
          componentSource: "react-persian-form",
          componentStatus: "needs-installation",
        }),
      ]),
      REGISTRY,
      "yup",
    );
    expect(rootKeys).not.toContain("datepicker");
    expect(warnings[0]).toMatch(/datepicker/);
  });

  it("ignores needs-decision fields for component resolution", () => {
    const { rootKeys } = collectRegistryKeys(
      analysisWith([
        field({ mappedComponent: "text", componentSource: "local", componentStatus: "resolved-local" }),
        field({ mappedComponent: null, componentStatus: "needs-decision" }),
      ]),
      REGISTRY,
      "yup",
    );
    expect(rootKeys).toEqual(["validation-yup"]);
  });
});

describe("resolveTransitiveKeys", () => {
  it("expands registryDependencies dependency-first", () => {
    const { keys } = resolveTransitiveKeys(["text"], REGISTRY);
    expect(keys).toContain("utils");
    expect(keys).toContain("component-core");
    expect(keys).toContain("text");
    expect(keys.indexOf("utils")).toBeLessThan(keys.indexOf("text"));
    expect(keys.indexOf("component-core")).toBeLessThan(keys.indexOf("text"));
  });

  it("de-dupes shared dependencies across roots", () => {
    const { keys } = resolveTransitiveKeys(["text", "cellphone"], REGISTRY);
    expect(keys.filter((k) => k === "utils")).toHaveLength(1);
    expect(keys.filter((k) => k === "component-core")).toHaveLength(1);
  });

  it("warns on an unknown dependency key", () => {
    const broken: RegistryEntry[] = [
      { key: "x", type: "component", description: "", files: [], dependencies: [], registryDependencies: ["ghost"] },
    ];
    const { warnings } = resolveTransitiveKeys(["x"], broken);
    expect(warnings[0]).toMatch(/ghost/);
  });
});

// ---- end to end (mocked network) --------------------------------------

describe("installComponents", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function read(rel: string): string {
    return fs.readFileSync(path.join(tmp, rel), "utf-8");
  }
  function exists(rel: string): boolean {
    return fs.existsSync(path.join(tmp, rel));
  }

  it("installs a component with its transitive deps into the configured dirs", async () => {
    const analysis = analysisWith([
      field({
        name: "firstName",
        mappedComponent: "text",
        componentSource: "react-persian-form",
        componentStatus: "needs-installation",
        mappedValidators: ["required"],
      }),
    ]);

    await installComponents(analysis, CONFIG, tmp, "42");

    expect(exists("src/components/form/fields/text/text.tsx")).toBe(true);
    expect(exists("src/components/form/fields/text/index.ts")).toBe(true);
    expect(exists("src/components/form/fields/_core/input.tsx")).toBe(true);
    expect(exists("src/components/form/fields/_core/formatter.ts")).toBe(true);
    expect(exists("src/utils/to-persian-digits.ts")).toBe(true);
    expect(exists("src/utils/index.ts")).toBe(true);

    // cross-prefix import was rewritten to reach src/utils
    expect(read("src/components/form/fields/text/text.tsx")).toContain(
      `from "../../../../utils/to-persian-digits"`,
    );
    // sibling import preserved
    expect(read("src/components/form/fields/text/text.tsx")).toContain(
      `from "../_core/formatter"`,
    );

    const log = JSON.parse(read("persian-form-agent.installation-log.json"));
    expect(log).toHaveLength(1);
    expect(log[0].taskId).toBe("42");
    expect(log[0].registryKeys).toContain("text");
    expect(log[0].registryKeys).toContain("utils");
    expect(log[0].npmDependencies).toContain("react-hook-form");
    expect(log[0].npmDependencies).toContain("clsx");
  });

  it("rewrites copied-file imports to the alias when config.importAlias is set", async () => {
    const analysis = analysisWith([
      field({
        name: "firstName",
        mappedComponent: "text",
        componentSource: "react-persian-form",
        componentStatus: "needs-installation",
        mappedValidators: ["required"],
      }),
    ]);

    await installComponents(
      analysis,
      { ...CONFIG, importAlias: { prefix: "~", base: "src" } },
      tmp,
      "42a",
    );

    const text = read("src/components/form/fields/text/text.tsx");
    expect(text).toContain(`from "~/utils/to-persian-digits"`);
    expect(text).toContain(`from "~/components/form/fields/_core/formatter"`);
    expect(text).not.toContain("../");
  });

  it("also installs the validation bundle when a custom validator is used", async () => {
    const analysis = analysisWith([
      field({
        name: "mobile",
        mappedComponent: "cellphone",
        componentSource: "react-persian-form",
        componentStatus: "needs-installation",
        mappedValidators: ["required", "cellPhoneNumber"],
      }),
    ]);

    await installComponents(analysis, CONFIG, tmp, "43");

    expect(exists("src/utils/validation/yup/cell-phone-number.ts")).toBe(true);
    expect(exists("src/utils/validation/yup/index.ts")).toBe(true);
    expect(exists("src/utils/is-valid-mobile.ts")).toBe(true);
    // validator -> utils import rewritten
    expect(read("src/utils/validation/yup/cell-phone-number.ts")).toContain(
      `from "../../is-valid-mobile"`,
    );
  });

  it("installs only the validation bundle when every component is local", async () => {
    const analysis = analysisWith([
      field({ mappedComponent: "text", componentSource: "local", componentStatus: "resolved-local" }),
    ]);
    await installComponents(analysis, CONFIG, tmp, "44");

    expect(exists("src/utils/validation/yup/index.ts")).toBe(true);
    expect(exists("src/components/form/fields/text/text.tsx")).toBe(false);

    const log = JSON.parse(read("persian-form-agent.installation-log.json"));
    expect(log[0].registryKeys).toContain("validation-yup");
    expect(log[0].registryKeys).not.toContain("text");
  });

  it("does nothing for an analysis with no fields", async () => {
    await installComponents(
      { taskId: "x", formName: "X", formType: "single", overallStatus: "ready", steps: [] },
      CONFIG,
      tmp,
      "44b",
    );
    expect(exists("persian-form-agent.installation-log.json")).toBe(false);
    expect(readComponentSourceMock).not.toHaveBeenCalled();
  });

  it("skips files that already exist and records them without refetching", async () => {
    const existing = path.join(tmp, "src/utils/to-persian-digits.ts");
    fs.mkdirSync(path.dirname(existing), { recursive: true });
    fs.writeFileSync(existing, "// pre-existing\n");

    const analysis = analysisWith([
      field({
        mappedComponent: "text",
        componentSource: "react-persian-form",
        componentStatus: "needs-installation",
      }),
    ]);
    await installComponents(analysis, CONFIG, tmp, "45");

    expect(read("src/utils/to-persian-digits.ts")).toBe("// pre-existing\n");
    expect(readComponentSourceMock).not.toHaveBeenCalledWith(
      "react-persian-form",
      "utils/to-persian-digits.ts",
      expect.anything(),
    );
    const log = JSON.parse(read("persian-form-agent.installation-log.json"));
    expect(log[0].files).toContain("src/utils/to-persian-digits.ts");
  });

  it("appends a second entry to an existing installation log", async () => {
    const analysis = analysisWith([
      field({
        mappedComponent: "text",
        componentSource: "react-persian-form",
        componentStatus: "needs-installation",
      }),
    ]);
    await installComponents(analysis, CONFIG, tmp, "46");
    await installComponents(analysis, CONFIG, tmp, "47");
    const log = JSON.parse(read("persian-form-agent.installation-log.json"));
    expect(log).toHaveLength(2);
    expect(log.map((e: { taskId: string }) => e.taskId)).toEqual(["46", "47"]);
  });
});
