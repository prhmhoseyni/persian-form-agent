/**
 * Detect an absolute-import alias already configured in the target project so
 * generated/installed code can use it (`~/components/...`) instead of deep
 * relative paths (`../../../../components/...`).
 *
 * We only ever *read* the project's config — never add or modify an alias.
 * If nothing usable is found, callers fall back to relative imports.
 */

import fs from "node:fs";
import path from "node:path";

export interface ImportAlias {
  /** Alias prefix without the trailing `/*` (e.g. `"~"`, `"@"`). */
  prefix: string;
  /**
   * Directory the alias resolves to, posix, relative to the project root.
   * `""` means the project root itself.
   */
  base: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse JSON that may contain `//` / `/* *​/` comments and trailing commas. */
function parseJsonc(text: string): unknown {
  const stripped = text
    .replace(
      /"(?:\\.|[^"\\])*"|\/\/[^\n\r]*|\/\*[\s\S]*?\*\//g,
      (m) => (m[0] === '"' ? m : ""),
    )
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

function readJsonc(file: string): Record<string, any> | null {
  try {
    const parsed = parseJsonc(fs.readFileSync(file, "utf-8"));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
}

/**
 * tsconfig/jsconfig files to inspect for `compilerOptions.paths`, following
 * `extends` and project `references` (relative paths only).
 */
function configChain(projectRoot: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (rel: string): void => {
    const abs = path.resolve(projectRoot, rel);
    if (seen.has(abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return;
    }
    seen.add(abs);
    found.push(abs);

    const json = readJsonc(abs);
    if (!json) return;
    const dir = path.dirname(rel);

    const exts = Array.isArray(json.extends)
      ? json.extends
      : json.extends
        ? [json.extends]
        : [];
    for (const e of exts) {
      if (typeof e === "string" && e.startsWith(".")) {
        add(path.join(dir, e));
      }
    }

    for (const ref of Array.isArray(json.references) ? json.references : []) {
      if (ref && typeof ref.path === "string") {
        const p = path.join(dir, ref.path);
        add(p.endsWith(".json") ? p : path.join(p, "tsconfig.json"));
      }
    }
  };

  for (const name of [
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.base.json",
    "jsconfig.json",
  ]) {
    add(name);
  }
  return found;
}

function aliasesFrom(file: string, projectRoot: string): ImportAlias[] {
  const json = readJsonc(file);
  const co = json?.compilerOptions;
  const paths = co?.paths;
  if (!paths || typeof paths !== "object") return [];

  const baseUrl: string =
    typeof co.baseUrl === "string" && co.baseUrl ? co.baseUrl : ".";
  const tsDir = path.dirname(file);
  const out: ImportAlias[] = [];

  for (const [key, value] of Object.entries(paths as Record<string, unknown>)) {
    if (!key.endsWith("/*")) continue;
    const target = Array.isArray(value) ? value[0] : undefined;
    if (typeof target !== "string" || !target.endsWith("/*")) continue;

    const abs = path.resolve(tsDir, baseUrl, target.slice(0, -2));
    let base = path.relative(projectRoot, abs).replace(/\\/g, "/");
    if (base === ".") base = "";
    if (base.startsWith("..")) continue; // resolves outside the project

    out.push({ prefix: key.slice(0, -2), base });
  }
  return out;
}

/** Most-useful alias first. */
function rank(aliases: ImportAlias[], mustCover?: string): ImportAlias[] {
  const cover = mustCover?.replace(/\\/g, "/").replace(/\/+$/, "");
  const seen = new Set<string>();
  const unique = aliases.filter((a) => {
    const k = `${a.prefix}|${a.base}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const covers = (a: ImportAlias): boolean =>
    !cover ||
    a.base === "" ||
    cover === a.base ||
    cover.startsWith(`${a.base}/`);

  const prefixRank = (p: string): number =>
    p === "~" ? 0 : p === "@" ? 1 : p === "$" ? 2 : 3;

  return unique
    .filter(covers)
    .sort(
      (a, b) =>
        // deepest base that still covers = most specific
        b.base.length - a.base.length ||
        prefixRank(a.prefix) - prefixRank(b.prefix),
    );
}

function readViteConfig(projectRoot: string): string | null {
  for (const name of [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cts",
    "vite.config.cjs",
  ]) {
    const file = path.join(projectRoot, name);
    if (fs.existsSync(file)) {
      try {
        return fs.readFileSync(file, "utf-8");
      } catch {
        return null;
      }
    }
  }
  return null;
}

function readPackageDeps(projectRoot: string): Record<string, string> {
  const json = readJsonc(path.join(projectRoot, "package.json"));
  return { ...(json?.dependencies ?? {}), ...(json?.devDependencies ?? {}) };
}

/**
 * Return the alias to use for generated imports, or `null` to use relative
 * imports. When `mustCover` is given (a project-relative dir), only an alias
 * whose base contains that dir is considered.
 *
 * A tsconfig `paths` entry is enough for `tsc`, Next.js and webpack. Under
 * Vite it only resolves if `vite-tsconfig-paths` is wired up or there's a
 * matching `resolve.alias`; when a Vite config is present and neither is
 * found we return `null` rather than emit imports that would break the build.
 */
export function detectImportAlias(
  projectRoot: string,
  mustCover?: string,
): ImportAlias | null {
  const candidates = rank(
    configChain(projectRoot).flatMap((f) => aliasesFrom(f, projectRoot)),
    mustCover,
  );
  if (candidates.length === 0) return null;

  const viteConfig = readViteConfig(projectRoot);
  if (viteConfig === null) return candidates[0]; // no Vite in play

  const deps = readPackageDeps(projectRoot);
  const hasTsconfigPaths =
    "vite-tsconfig-paths" in deps ||
    /vite-tsconfig-paths|tsconfigPaths\s*\(/.test(viteConfig);
  if (hasTsconfigPaths) return candidates[0];

  for (const alias of candidates) {
    const manualAlias = new RegExp(
      `alias[\\s\\S]{0,600}["'\`]${escapeRegExp(alias.prefix)}(?:/\\*)?["'\`]`,
    );
    if (manualAlias.test(viteConfig)) return alias;
  }
  return null;
}

/**
 * Build an import specifier for `targetProjectRelPath` (posix, project-root
 * relative). Uses `alias` when it covers the target, otherwise a `./`-/`../`-
 * prefixed path relative to `fromDir`.
 */
export function importSpecifier(
  alias: ImportAlias | null | undefined,
  targetProjectRelPath: string,
  fromDir: string,
): string {
  const target = targetProjectRelPath.replace(/\\/g, "/").replace(/\/+$/, "");

  if (alias) {
    const rel =
      alias.base === ""
        ? target
        : path.posix.relative(alias.base, target);
    if (rel && !rel.startsWith("..")) {
      return `${alias.prefix}/${rel}`;
    }
  }

  let rel = path.posix.relative(
    fromDir.replace(/\\/g, "/").replace(/\/+$/, ""),
    target,
  );
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}
