import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyTailwindSetup } from "./verifySetup.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "persian-form-agent-test-"));
}

describe("verifyTailwindSetup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns ok when @import tailwindcss found in src/index.css", () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "index.css"),
      '@import "tailwindcss";\nbody { margin: 0; }',
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.matchFile).toBe("src/index.css");
    expect(result.checkedFiles).toContain("src/index.css");
  });

  it("returns ok when found in app/globals.css", () => {
    fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "app", "globals.css"),
      '@import "tailwindcss";',
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.matchFile).toBe("app/globals.css");
  });

  it("returns ok with single quotes", () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "index.css"),
      "@import 'tailwindcss';",
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
  });

  it("returns ok with extra whitespace", () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "index.css"),
      '@import  "tailwindcss"  ;',
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
  });

  it("returns not ok when no CSS files exist", () => {
    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.checkedFiles).toHaveLength(0);
    expect(result.matchFile).toBeNull();
  });

  it("returns not ok when CSS exists but no tailwind import", () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "index.css"),
      "body { margin: 0; }",
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.checkedFiles).toContain("src/index.css");
    expect(result.matchFile).toBeNull();
  });

  it("searches nested directories", () => {
    fs.mkdirSync(path.join(tmpDir, "src", "styles"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "styles", "main.css"),
      '@import "tailwindcss";',
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.matchFile).toBe("src/styles/main.css");
  });

  it("skips node_modules directories", () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "node_modules", "pkg", "style.css"),
      '@import "tailwindcss";',
    );
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.css"), "body {}");

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(false);
  });

  it("checks root-level CSS files", () => {
    fs.writeFileSync(
      path.join(tmpDir, "globals.css"),
      '@import "tailwindcss";',
    );

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.matchFile).toBe("globals.css");
  });

  it("finds tailwind in first matching file and returns", () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "a.css"), "body {}");
    fs.writeFileSync(path.join(tmpDir, "src", "b.css"), '@import "tailwindcss";');

    const result = verifyTailwindSetup(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.matchFile).toBe("src/b.css");
  });
});
