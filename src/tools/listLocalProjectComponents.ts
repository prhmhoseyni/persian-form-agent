import fs from "node:fs";
import path from "node:path";

export function listLocalProjectComponents(
  projectRoot: string,
  formComponentsPath: string,
): string[] {
  const fullPath = path.join(projectRoot, formComponentsPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .filter((d) => d.isFile() && (d.name.endsWith(".tsx") || d.name.endsWith(".ts")))
    .map((d) => d.name);
}
