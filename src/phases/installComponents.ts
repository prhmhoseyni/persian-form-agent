import fs from "node:fs";
import path from "node:path";
import type { AnalysisData, FormField } from "../types.js";
import type { AgentConfig } from "./bootstrap.js";
import { readComponentSource } from "../tools/readComponentSource.js";

interface InstallationLogEntry {
  taskId: string;
  installedAt: string;
  ref: string;
  files: string[];
}

function parseImports(sourceCode: string): string[] {
  const imports: string[] = [];
  const importRegex =
    /(?:import|from)\s+(?:type\s+)?{[^}]*}\s+from\s+["']([^"']+)["']/g;
  const importDefaultRegex =
    /(?:import|from)\s+\w+\s+from\s+["']([^"']+)["']/g;

  let match;
  while ((match = importRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }
  while ((match = importDefaultRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  return imports.filter(
    (imp) => imp.startsWith("./") || imp.startsWith("../"),
  );
}

function resolveImportPath(
  importPath: string,
  sourceFilePath: string,
): string {
  const sourceDir = path.dirname(sourceFilePath);
  return path.resolve(sourceDir, importPath);
}

function mapImportToLocalPath(
  importPath: string,
  config: AgentConfig,
): string | null {
  // Map react-persian-form imports to local project paths
  if (
    importPath.includes("/components/") ||
    importPath.includes("\\components\\")
  ) {
    const relativePath = importPath.replace(/.*\/components\//, "");
    return path.join(config.paths.formComponents, relativePath);
  }
  if (
    importPath.includes("/validators/") ||
    importPath.includes("\\validators\\")
  ) {
    const relativePath = importPath.replace(/.*\/validators\//, "");
    return path.join(
      path.dirname(config.paths.customValidators),
      relativePath,
    );
  }
  if (importPath.includes("/utils/") || importPath.includes("\\utils\\")) {
    const relativePath = importPath.replace(/.*\/utils\//, "");
    return path.join(
      path.dirname(config.paths.customValidators),
      "..",
      "utils",
      relativePath,
    );
  }
  return null;
}

export async function installComponents(
  analysis: AnalysisData,
  config: AgentConfig,
  projectRoot: string,
  taskId: string,
): Promise<void> {
  const filesToInstall: { field: FormField; rpfPath: string }[] = [];

  // Collect all files that need installation
  for (const step of analysis.steps) {
    for (const field of step.fields) {
      if (
        field.componentStatus === "needs-installation" &&
        field.mappedComponent &&
        field.componentSource === "react-persian-form"
      ) {
        // Determine the source path in react-persian-form
        const rpfPath = resolveRpfPath(field, config);
        if (rpfPath) {
          filesToInstall.push({ field, rpfPath });
        }
      }
    }
  }

  if (filesToInstall.length === 0) {
    console.log("No components need installation.");
    return;
  }

  const installedFiles: string[] = [];
  const visited = new Set<string>();

  for (const { field, rpfPath } of filesToInstall) {
    await installFileRecursive(
      rpfPath,
      config,
      projectRoot,
      installedFiles,
      visited,
    );
  }

  // Write installation log
  const logPath = path.join(projectRoot, "installation-log.json");
  const log: InstallationLogEntry[] = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : [];

  log.push({
    taskId,
    installedAt: new Date().toISOString(),
    ref: config.reactPersianForm.ref,
    files: installedFiles,
  });

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");
  console.log(`Installed ${installedFiles.length} files. See installation-log.json`);
}

function resolveRpfPath(
  field: FormField,
  config: AgentConfig,
): string | null {
  if (!field.mappedComponent) return null;

  // Check if it's a component
  const componentPath = `${config.reactPersianForm.paths.components}/${field.mappedComponent}.tsx`;
  // Check if it's a validator
  const validatorPath = `${config.reactPersianForm.paths.validators}/${field.mappedComponent.toLowerCase()}.ts`;

  // Return the most likely path (component by default)
  return componentPath;
}

async function installFileRecursive(
  rpfPath: string,
  config: AgentConfig,
  projectRoot: string,
  installedFiles: string[],
  visited: Set<string>,
): Promise<void> {
  if (visited.has(rpfPath)) return;
  visited.add(rpfPath);

  // Determine local destination
  const localPath = mapImportToLocalPath(rpfPath, config);
  if (!localPath) {
    console.warn(`  Cannot map ${rpfPath} to a local path, skipping`);
    return;
  }

  const fullLocalPath = path.join(projectRoot, localPath);

  // Skip if already exists
  if (fs.existsSync(fullLocalPath)) {
    console.log(`  Already exists: ${localPath}`);
    return;
  }

  // Fetch from GitHub
  const content = await readComponentSource("react-persian-form", rpfPath, {
    projectRoot,
    rpfConfig: config.reactPersianForm,
  });

  // Create directory and write file
  const dir = path.dirname(fullLocalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullLocalPath, content);
  installedFiles.push(localPath);
  console.log(`  Installed: ${localPath}`);

  // Parse imports and recursively install dependencies
  const imports = parseImports(content);
  for (const imp of imports) {
    // Only follow imports from the react-persian-form repo
    if (imp.startsWith("./") || imp.startsWith("../")) {
      const resolvedPath = resolveImportPath(imp, rpfPath);
      await installFileRecursive(
        resolvedPath,
        config,
        projectRoot,
        installedFiles,
        visited,
      );
    }
  }
}
