import fs from "node:fs";
import path from "node:path";
import type { AnalysisData } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";
import { readComponentSource } from "../tools/readComponentSource.js";
import {
  fetchRegistry,
  type RegistryEntry,
} from "../tools/reactPersianFormRegistry.js";
import {
  readLocalDeps,
  detectPackageManager,
  buildInstallCommand,
} from "./checkPeerDependencies.js";

interface InstallationLogEntry {
  taskId: string;
  installedAt: string;
  ref: string;
  /** Registry keys resolved for this task, including transitive dependencies. */
  registryKeys: string[];
  /** Project-relative paths of the files written (or already present). */
  files: string[];
  /** npm packages the installed registry entries declare as dependencies. */
  npmDependencies: string[];
}

/**
 * Where each `templates/<prefix>/…` tree lands inside the target project.
 * Derived from `agent.config.json` `paths`.
 */
export interface LocalLayout {
  /** `templates/components/**` → here (posix, project-relative). */
  components: string;
  /** `templates/validation/**` → here. */
  validation: string;
  /** `templates/utils/**` → here. */
  utils: string;
}

export function resolveLocalLayout(config: AgentConfig): LocalLayout {
  const toPosix = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
  return {
    components: toPosix(config.paths.formComponents),
    // e.g. "src/utils/validation/yup-extensions.ts" → "src/utils/validation"
    validation: toPosix(path.posix.dirname(toPosix(config.paths.customValidators))),
    utils: toPosix(config.paths.utils),
  };
}

/**
 * Project-relative (posix) directory that the configured validation library's
 * bundle index is installed into — the place generated forms import
 * `useYupValidationResolver` (and the Persian `yup.setLocale`) from. Mirrors
 * where `installComponents` writes the `validation-<lib>` registry entry.
 */
export function validationBundleDir(config: AgentConfig): string {
  const layout = resolveLocalLayout(config);
  const indexPath = mapTemplatePathToLocal(
    `validation/${config.validationLibrary}/index.ts`,
    layout,
  );
  return indexPath ? path.posix.dirname(indexPath) : layout.validation;
}

/** Strip a leading `./`, `/` or `templates/` and normalise slashes. */
function normalizeTemplatePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/^templates\//, "");
}

/**
 * Map a registry file path (relative to the repo's `templates/` dir, e.g.
 * `components/text/text.tsx`) to a project-relative path. Returns `null` for
 * prefixes we don't install (e.g. `theme/`).
 */
export function mapTemplatePathToLocal(
  templatePath: string,
  layout: LocalLayout,
): string | null {
  const norm = normalizeTemplatePath(templatePath);
  const slash = norm.indexOf("/");
  if (slash === -1) return null;

  const prefix = norm.slice(0, slash);
  const rest = norm.slice(slash + 1);

  const base =
    prefix === "components"
      ? layout.components
      : prefix === "validation"
        ? layout.validation
        : prefix === "utils"
          ? layout.utils
          : null;

  if (base === null) return null;
  return path.posix.join(base, rest);
}

/**
 * Rewrite the relative import specifiers in a fetched file so they still
 * resolve once the `templates/` tree has been split across the project's
 * configured directories. Imports that stay within the same prefix are
 * unchanged; cross-prefix imports (component → utils, validator → utils) are
 * repointed. Non-relative and unmappable specifiers are left untouched.
 */
export function rewriteRelativeImports(
  content: string,
  srcTemplatePath: string,
  layout: LocalLayout,
): string {
  const srcLocal = mapTemplatePathToLocal(srcTemplatePath, layout);
  if (!srcLocal) return content;

  const srcLocalDir = path.posix.dirname(srcLocal);
  const srcTplDir = path.posix.dirname(normalizeTemplatePath(srcTemplatePath));

  return content.replace(
    /((?:from|import)\s*)(["'])(\.\.?\/[^"']*?)\2/g,
    (whole, keyword: string, quote: string, spec: string) => {
      const targetTpl = path.posix.normalize(path.posix.join(srcTplDir, spec));
      const targetLocal = mapTemplatePathToLocal(targetTpl, layout);
      if (!targetLocal) return whole;

      let rel = path.posix.relative(srcLocalDir, targetLocal);
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return `${keyword}${quote}${rel}${quote}`;
    },
  );
}

type RegistryIndex = Map<string, RegistryEntry>;

function buildIndex(entries: RegistryEntry[]): RegistryIndex {
  return new Map(entries.map((e) => [e.key, e]));
}

function findComponentKey(
  mappedComponent: string,
  index: RegistryIndex,
): string | null {
  if (index.has(mappedComponent)) return mappedComponent;
  const lower = mappedComponent.toLowerCase();
  for (const entry of index.values()) {
    if (entry.type === "component" && entry.key.toLowerCase() === lower) {
      return entry.key;
    }
  }
  return null;
}

/** Pick the `validation` registry entry that matches the configured library. */
function findValidationEntry(
  entries: RegistryEntry[],
  validationLibrary: string,
): RegistryEntry | undefined {
  const validation = entries.filter((e) => e.type === "validation");
  return (
    validation.find((e) => e.key.endsWith(`-${validationLibrary}`)) ??
    validation.find((e) => e.key.includes(validationLibrary)) ??
    validation[0]
  );
}

export interface CollectedKeys {
  /** Registry keys explicitly required by the analysis (no deps yet). */
  rootKeys: string[];
  warnings: string[];
}

/**
 * Walk the analysis and decide which registry entries to install:
 *
 * - the `mappedComponent` of every `needs-installation` react-persian-form field;
 * - the `validation` bundle for the configured library, whenever the analysis
 *   has any fields — the generated form imports `useYupValidationResolver` and
 *   the Persian `yup.setLocale` config from it, and calls its custom methods
 *   (e.g. `.cellPhoneNumber()`) from the schema.
 */
export function collectRegistryKeys(
  analysis: AnalysisData,
  entries: RegistryEntry[],
  validationLibrary: string,
): CollectedKeys {
  const index = buildIndex(entries);
  const rootKeys = new Set<string>();
  const warnings: string[] = [];

  const validationEntry = findValidationEntry(entries, validationLibrary);
  let hasFields = false;

  for (const step of analysis.steps) {
    for (const field of step.fields) {
      hasFields = true;

      const needsComponent =
        field.componentStatus === "needs-installation" &&
        field.componentSource === "react-persian-form" &&
        !!field.mappedComponent;

      if (needsComponent) {
        const key = findComponentKey(field.mappedComponent as string, index);
        if (key) {
          rootKeys.add(key);
        } else {
          warnings.push(
            `Field "${field.name}": no react-persian-form registry entry for component "${field.mappedComponent}" — skipping install.`,
          );
        }
      }
    }
  }

  if (hasFields && validationEntry) {
    rootKeys.add(validationEntry.key);
  }

  return { rootKeys: [...rootKeys], warnings };
}

/**
 * Expand a set of registry keys with their transitive `registryDependencies`,
 * returned dependency-first (a key always appears after everything it needs).
 */
export function resolveTransitiveKeys(
  rootKeys: string[],
  entries: RegistryEntry[],
): { keys: string[]; warnings: string[] } {
  const index = buildIndex(entries);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];

  const visit = (key: string, trail: string[]): void => {
    if (seen.has(key)) return;
    if (trail.includes(key)) return; // cycle guard
    const entry = index.get(key);
    if (!entry) {
      warnings.push(`Unknown registry dependency "${key}" — skipping.`);
      return;
    }
    for (const dep of entry.registryDependencies) {
      visit(dep, [...trail, key]);
    }
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  };

  for (const key of rootKeys) visit(key, []);
  return { keys: ordered, warnings };
}

export async function installComponents(
  analysis: AnalysisData,
  config: AgentConfig,
  projectRoot: string,
  taskId: string,
): Promise<void> {
  const { repoOwner, repoName, ref } = config.reactPersianForm;
  const entries = await fetchRegistry(repoOwner, repoName, ref);

  const { rootKeys, warnings: collectWarnings } = collectRegistryKeys(
    analysis,
    entries,
    config.validationLibrary,
  );
  for (const w of collectWarnings) console.warn(`  ⚠ ${w}`);

  if (rootKeys.length === 0) {
    console.log("No components need installation.");
    return;
  }

  const { keys, warnings: resolveWarnings } = resolveTransitiveKeys(
    rootKeys,
    entries,
  );
  for (const w of resolveWarnings) console.warn(`  ⚠ ${w}`);

  const layout = resolveLocalLayout(config);
  const index = buildIndex(entries);

  const installedFiles: string[] = [];
  const npmDependencies = new Set<string>();

  for (const key of keys) {
    const entry = index.get(key);
    if (!entry) continue;

    for (const dep of entry.dependencies) npmDependencies.add(dep);

    for (const file of entry.files) {
      const dest = mapTemplatePathToLocal(file, layout);
      if (!dest) {
        console.warn(
          `  ⚠ ${key}: don't know where to put "${file}" — skipping.`,
        );
        continue;
      }

      const fullLocalPath = path.join(projectRoot, dest);
      if (fs.existsSync(fullLocalPath)) {
        console.log(`  = exists  ${dest}`);
        if (!installedFiles.includes(dest)) installedFiles.push(dest);
        continue;
      }

      const raw = await readComponentSource("react-persian-form", file, {
        projectRoot,
        rpfConfig: config.reactPersianForm,
      });
      const content = rewriteRelativeImports(raw, file, layout);

      fs.mkdirSync(path.dirname(fullLocalPath), { recursive: true });
      fs.writeFileSync(fullLocalPath, content);
      installedFiles.push(dest);
      console.log(`  + write   ${dest}`);
    }
  }

  const logPath = path.join(projectRoot, "installation-log.json");
  const log: InstallationLogEntry[] = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : [];

  log.push({
    taskId,
    installedAt: new Date().toISOString(),
    ref,
    registryKeys: keys,
    files: installedFiles,
    npmDependencies: [...npmDependencies],
  });

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

  console.log(
    `Installed ${installedFiles.length} file(s) from ${keys.length} registry entr${
      keys.length === 1 ? "y" : "ies"
    } (${keys.join(", ")}).`,
  );

  if (npmDependencies.size > 0) {
    const localDeps = readLocalDeps(projectRoot);
    const missing = [...npmDependencies].filter((d) => !localDeps.has(d));
    if (missing.length > 0) {
      const cmd = buildInstallCommand(
        missing,
        detectPackageManager(projectRoot),
      );
      console.log(
        `\n⚠ The installed components need npm packages you don't have yet:\n` +
          `  ${missing.join(", ")}\n` +
          `Install them with:\n  ${cmd}\n`,
      );
    }
  }

  console.log("See installation-log.json for details.");
}
