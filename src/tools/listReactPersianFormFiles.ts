import path from "node:path";
import {
  readCache,
  writeCache,
  isCacheFresh,
  type RpfListingCache,
  type RpfListingItem,
} from "../cache/rpfListingCache.js";
import { fetchRegistry, type RegistryEntry } from "./reactPersianFormRegistry.js";

type Category = "components" | "validators" | "utils";

function kebabToCamel(input: string): string {
  return input.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Registry entry whose `type` puts it in this analysis category. */
const CATEGORY_TYPES: Record<Category, string[]> = {
  components: ["component"],
  validators: ["validation"],
  utils: ["utils"],
};

function isSourceFile(file: string): boolean {
  const base = path.basename(file);
  return (
    !base.includes(".test.") &&
    base !== "index.ts" &&
    base !== "index.tsx" &&
    base !== ".gitkeep"
  );
}

/**
 * `components` are surfaced one item per registry entry (name = registry key).
 * `validators` / `utils` are flattened to one item per source file, with a
 * camelCase `name` derived from the filename so the analysis can reference
 * e.g. `cellPhoneNumber` rather than a bundle.
 */
function toItems(entries: RegistryEntry[], category: Category): RpfListingItem[] {
  const matches = entries.filter((e) =>
    CATEGORY_TYPES[category].includes(e.type),
  );

  if (category === "components") {
    return matches.map((e) => ({
      name: e.key,
      description: e.description,
      files: e.files,
    }));
  }

  const items: RpfListingItem[] = [];
  for (const entry of matches) {
    for (const file of entry.files) {
      if (!isSourceFile(file)) continue;
      const stem = path.basename(file).replace(/\.[^.]+$/, "");
      items.push({
        name: kebabToCamel(stem),
        description: entry.description,
        files: [file],
      });
    }
  }
  return items;
}

function buildListing(entries: RegistryEntry[]): RpfListingCache["listing"] {
  return {
    components: toItems(entries, "components"),
    validators: toItems(entries, "validators"),
    utils: toItems(entries, "utils"),
  };
}

export async function listReactPersianFormFiles(
  projectRoot: string,
  config: {
    cache: { path: string; ttlHours: number };
    reactPersianForm: {
      repoOwner: string;
      repoName: string;
      ref: string;
    };
  },
  category: Category,
): Promise<RpfListingItem[]> {
  const cacheFullPath = path.join(projectRoot, config.cache.path);
  const cache = readCache(cacheFullPath);

  if (
    cache &&
    isCacheFresh(cache) &&
    cache.meta.repoOwner === config.reactPersianForm.repoOwner &&
    cache.meta.repoName === config.reactPersianForm.repoName &&
    cache.meta.ref === config.reactPersianForm.ref
  ) {
    return cache.listing[category] ?? [];
  }

  const entries = await fetchRegistry(
    config.reactPersianForm.repoOwner,
    config.reactPersianForm.repoName,
    config.reactPersianForm.ref,
  );

  const listing = buildListing(entries);

  const newCache: RpfListingCache = {
    meta: {
      repoOwner: config.reactPersianForm.repoOwner,
      repoName: config.reactPersianForm.repoName,
      ref: config.reactPersianForm.ref,
      fetchedAt: new Date().toISOString(),
      ttlHours: config.cache.ttlHours,
    },
    listing,
  };

  writeCache(cacheFullPath, newCache);

  return listing[category] ?? [];
}
