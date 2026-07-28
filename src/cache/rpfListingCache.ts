import fs from "node:fs";
import path from "node:path";

export interface RpfListingCache {
  meta: {
    repoOwner: string;
    repoName: string;
    ref: string;
    fetchedAt: string;
    ttlHours: number;
  };
  listing: {
    components: string[];
    validators: string[];
    utils: string[];
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
  const fetchedAt = new Date(cache.meta.fetchedAt).getTime();
  const ttlMs = cache.meta.ttlHours * 60 * 60 * 1000;
  return Date.now() - fetchedAt < ttlMs;
}
