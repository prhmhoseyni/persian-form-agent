import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectImportAlias, importSpecifier } from "./detectImportAlias.js";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "persian-form-agent-alias-"));
}

function write(dir: string, rel: string, content: string): void {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("detectImportAlias", () => {
  let dir: string;
  beforeEach(() => {
    dir = tmp();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no config declares paths", () => {
    write(dir, "tsconfig.json", JSON.stringify({ compilerOptions: {} }));
    expect(detectImportAlias(dir)).toBeNull();
  });

  it("reads a ~/* -> src/* alias from tsconfig", () => {
    write(
      dir,
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "~/*": ["src/*"] } },
      }),
    );
    expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
  });

  it("normalises ./src/* and resolves baseUrl", () => {
    write(
      dir,
      "jsconfig.json",
      JSON.stringify({
        compilerOptions: { baseUrl: "./src", paths: { "@/*": ["./*"] } },
      }),
    );
    expect(detectImportAlias(dir)).toEqual({ prefix: "@", base: "src" });
  });

  it("tolerates JSONC comments and trailing commas", () => {
    write(
      dir,
      "tsconfig.json",
      `{
        // editor config
        "compilerOptions": {
          /* bundler mode */
          "paths": { "~/*": ["src/*"], },
        },
      }`,
    );
    expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
  });

  it("follows project references to find the alias", () => {
    write(
      dir,
      "tsconfig.json",
      JSON.stringify({ files: [], references: [{ path: "./tsconfig.app.json" }] }),
    );
    write(
      dir,
      "tsconfig.app.json",
      JSON.stringify({ compilerOptions: { paths: { "~/*": ["src/*"] } } }),
    );
    expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
  });

  it("filters to an alias that covers `mustCover`", () => {
    write(
      dir,
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          paths: { "~/*": ["app/*"], "#/*": ["src/*"] },
        },
      }),
    );
    expect(detectImportAlias(dir, "src/components/form/fields")).toEqual({
      prefix: "#",
      base: "src",
    });
  });

  it("ignores an alias resolving outside the project", () => {
    write(
      dir,
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { paths: { "~/*": ["../shared/*"] } } }),
    );
    expect(detectImportAlias(dir)).toBeNull();
  });

  describe("Vite guard", () => {
    beforeEach(() => {
      write(
        dir,
        "tsconfig.json",
        JSON.stringify({ compilerOptions: { paths: { "~/*": ["src/*"] } } }),
      );
    });

    it("returns null when a Vite config has no path resolution", () => {
      write(dir, "vite.config.ts", `export default { plugins: [] };`);
      expect(detectImportAlias(dir)).toBeNull();
    });

    it("accepts the alias when vite-tsconfig-paths is a dependency", () => {
      write(dir, "vite.config.ts", `export default { plugins: [] };`);
      write(
        dir,
        "package.json",
        JSON.stringify({ devDependencies: { "vite-tsconfig-paths": "^5.0.0" } }),
      );
      expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
    });

    it("accepts the alias when vite.config wires tsconfigPaths()", () => {
      write(
        dir,
        "vite.config.ts",
        `import tsconfigPaths from "vite-tsconfig-paths";\nexport default { plugins: [tsconfigPaths()] };`,
      );
      expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
    });

    it("accepts the alias when vite.config has a matching resolve.alias", () => {
      write(
        dir,
        "vite.config.ts",
        `import path from "node:path";
export default {
  resolve: { alias: { "~": path.resolve(__dirname, "src") } },
};`,
      );
      expect(detectImportAlias(dir)).toEqual({ prefix: "~", base: "src" });
    });
  });
});

describe("importSpecifier", () => {
  it("uses the alias when it covers the target", () => {
    expect(
      importSpecifier(
        { prefix: "~", base: "src" },
        "src/components/form/fields/text",
        "src/features/forms",
      ),
    ).toBe("~/components/form/fields/text");
  });

  it("handles a root-based alias", () => {
    expect(
      importSpecifier({ prefix: "@", base: "" }, "src/utils/x", "src/features/forms"),
    ).toBe("@/src/utils/x");
  });

  it("falls back to a relative path when there is no alias", () => {
    expect(
      importSpecifier(null, "src/components/form/fields/text", "src/features/forms"),
    ).toBe("../../components/form/fields/text");
  });

  it("falls back to relative when the alias does not cover the target", () => {
    expect(
      importSpecifier(
        { prefix: "~", base: "app" },
        "src/utils/x",
        "src/features/forms",
      ),
    ).toBe("../../utils/x");
  });
});
