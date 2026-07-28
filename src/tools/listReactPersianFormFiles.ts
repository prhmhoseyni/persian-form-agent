import path from "node:path";
import {
  readCache,
  writeCache,
  isCacheFresh,
  type RpfListingCache,
} from "../cache/rpfListingCache.js";

type Category = "components" | "validators" | "utils";

const CATEGORY_PATHS: Record<Category, string> = {
  components: "src/components",
  validators: "src/validators",
  utils: "src/utils",
};

async function fetchGitHubContents(
  owner: string,
  repo: string,
  ref: string,
  dirPath: string,
): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${ref}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ai-form-agent",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} for ${url}`,
    );
  }

  const data = (await response.json()) as Array<{
    name: string;
    type: string;
  }>;

  return data
    .filter((item) => item.type === "file")
    .map((item) => item.name);
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
): Promise<string[]> {
  const cacheFullPath = path.join(projectRoot, config.cache.path);
  let cache = readCache(cacheFullPath);

  if (cache && isCacheFresh(cache)) {
    return cache.listing[category] || [];
  }

  // Fetch fresh data from GitHub
  const listing: RpfListingCache["listing"] = {
    components: [],
    validators: [],
    utils: [],
  };

  for (const cat of Object.keys(CATEGORY_PATHS) as Category[]) {
    listing[cat] = await fetchGitHubContents(
      config.reactPersianForm.repoOwner,
      config.reactPersianForm.repoName,
      config.reactPersianForm.ref,
      CATEGORY_PATHS[cat],
    );
  }

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

  return listing[category] || [];
}
