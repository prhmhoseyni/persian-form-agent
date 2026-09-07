import fs from "node:fs";
import path from "node:path";

/** One resolvable item (component, validator, or util) from react-persian-form. */
export interface RpfListingItem {
  /** Name the analysis should reference, e.g. "text", "cellPhoneNumber". */
  name: string;
  description: string;
  /** Source file paths relative to the repo's `templates/` directory. */
  files: string[];
}

export interface RpfListingCache {
  meta: {
    repoOwner: string;
    repoName: string;
    ref: string;
    fetchedAt: string;
    ttlHours: number;
  };
  listing: {
    components: RpfListingItem[];
    validators: RpfListingItem[];
    utils: RpfListingItem[];
  };
}

export function readCache(cachePath: string): RpfListingCache | null {
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeCache(cachePath: string, data: RpfListingCache): void {
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2) + "\n");
}

export function isCacheFresh(cache: RpfListingCache): boolean {
  // Guard against a cache written by an older layout (string[] listings).
  const l = cache.listing;
  const shaped =
    l &&
    Array.isArray(l.components) &&
    Array.isArray(l.validators) &&
    Array.isArray(l.utils) &&
    [...l.components, ...l.validators, ...l.utils].every(
      (item) => item && typeof item === "object" && "name" in item,
    );
  if (!shaped) return false;

  const fetchedAt = new Date(cache.meta.fetchedAt).getTime();
  const ttlMs = cache.meta.ttlHours * 60 * 60 * 1000;
  return Date.now() - fetchedAt < ttlMs;
}
