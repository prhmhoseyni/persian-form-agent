import fs from "node:fs";
import path from "node:path";

type Source = "local" | "react-persian-form";

export async function readComponentSource(
  source: Source,
  filePath: string,
  options?: {
    projectRoot?: string;
    rpfConfig?: {
      repoOwner: string;
      repoName: string;
      ref: string;
    };
  },
): Promise<string> {
  if (source === "local") {
    if (!options?.projectRoot) {
      throw new Error("projectRoot is required for local source");
    }
    const fullPath = path.join(options.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, "utf-8");
  }

  // react-persian-form: fetch from raw.githubusercontent.com
  if (!options?.rpfConfig) {
    throw new Error("rpfConfig is required for react-persian-form source");
  }

  const { repoOwner, repoName, ref } = options.rpfConfig;
  const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${ref}/${filePath}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "persian-form-agent" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}
