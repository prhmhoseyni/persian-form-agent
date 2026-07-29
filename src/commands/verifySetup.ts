import fs from "node:fs";
import path from "node:path";

const TAILWIND_IMPORT_PATTERN = /@import\s+["']tailwindcss["']/;

const CSS_SEARCH_DIRS = ["src", "app", "styles"];
const CSS_ENTRY_NAMES = ["index.css", "globals.css", "app.css", "main.css", "style.css"];

export interface VerifyResult {
  ok: boolean;
  checkedFiles: string[];
  matchFile: string | null;
}

function findCssFiles(dir: string, maxDepth: number): string[] {
  if (maxDepth < 0) return [];
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".css")) {
      results.push(fullPath);
    } else if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      results.push(...findCssFiles(fullPath, maxDepth - 1));
    }
  }

  return results;
}

export function verifyTailwindSetup(projectRoot: string): VerifyResult {
  const checkedFiles: string[] = [];
  const cssFiles = new Set<string>();

  for (const name of CSS_ENTRY_NAMES) {
    const rootFile = path.join(projectRoot, name);
    if (fs.existsSync(rootFile) && fs.statSync(rootFile).isFile()) {
      cssFiles.add(rootFile);
    }
  }

  for (const dir of CSS_SEARCH_DIRS) {
    const fullDir = path.join(projectRoot, dir);
    if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
      const found = findCssFiles(fullDir, 4);
      for (const f of found) {
        cssFiles.add(f);
      }
    }
  }

  for (const cssFile of cssFiles) {
    try {
      const content = fs.readFileSync(cssFile, "utf-8");
      checkedFiles.push(path.relative(projectRoot, cssFile));

      if (TAILWIND_IMPORT_PATTERN.test(content)) {
        return { ok: true, checkedFiles, matchFile: path.relative(projectRoot, cssFile) };
      }
    } catch {
      // skip unreadable files
    }
  }

  return { ok: false, checkedFiles, matchFile: null };
}

export function runVerifySetup(projectRoot: string): void {
  const result = verifyTailwindSetup(projectRoot);

  if (result.ok) {
    console.log(`✔ Tailwind v4 is properly configured (found in ${result.matchFile})`);
    return;
  }

  if (result.checkedFiles.length === 0) {
    console.log("⚠ No CSS files found in the project.");
  } else {
    console.log(`⚠ Tailwind v4 import not found. Searched ${result.checkedFiles.length} CSS file(s):`);
    for (const f of result.checkedFiles) {
      console.log(`  - ${f}`);
    }
  }

  console.log(`
Please add to your main CSS file:
  @import "tailwindcss";

Docs: https://tailwindcss.com/docs/installation
`);
  process.exit(1);
}
