/**
 * react-persian-form ships a component registry at `registry/registry.json`
 * and keeps the copyable source under `templates/`. We read that manifest
 * instead of crawling the repo tree via the GitHub API — one request to
 * raw.githubusercontent.com, no 60-req/hr rate limit, no 404s when the repo
 * layout shifts.
 */

/** Path of the registry manifest inside the repo. */
export const REGISTRY_PATH = "registry/registry.json";

/** Directory (inside the repo) that the registry `files` paths are relative to. */
export const TEMPLATES_DIR = "templates";

export interface RegistryEntry {
  /** Registry key, e.g. "text", "cellphone", "validation-yup", "utils". */
  key: string;
  /** "component" | "component-core" | "validation" | "utils" | "theme" | ... */
  type: string;
  description: string;
  /** Repo-relative-to-`templates/` file paths, e.g. "components/text/text.tsx". */
  files: string[];
  dependencies: string[];
  registryDependencies: string[];
}

type RawEntry = {
  type?: string;
  description?: string;
  files?: string[];
  dependencies?: string[];
  registryDependencies?: string[];
};

export function rawRegistryUrl(
  owner: string,
  repo: string,
  ref: string,
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${REGISTRY_PATH}`;
}

export async function fetchRegistry(
  owner: string,
  repo: string,
  ref: string,
): Promise<RegistryEntry[]> {
  const url = rawRegistryUrl(owner, repo, ref);
  const response = await fetch(url, {
    headers: { "User-Agent": "persian-form-agent" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch react-persian-form registry: ${response.status} ${response.statusText} for ${url}`,
    );
  }

  const raw = (await response.json()) as Record<string, RawEntry>;

  return Object.entries(raw).map(([key, entry]) => ({
    key,
    type: entry.type ?? "unknown",
    description: entry.description ?? "",
    files: entry.files ?? [],
    dependencies: entry.dependencies ?? [],
    registryDependencies: entry.registryDependencies ?? [],
  }));
}
