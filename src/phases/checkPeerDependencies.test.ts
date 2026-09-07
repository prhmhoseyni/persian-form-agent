import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  detectPackageManager,
  readLocalDeps,
  getRequiredDeps,
  buildInstallCommand,
  checkPeerDependencies,
} from "./checkPeerDependencies.js";
import type { PackageManager } from "./checkPeerDependencies.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "persian-form-agent-test-"));
}

describe("detectPackageManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir).name).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir).name).toBe("yarn");
  });

  it("detects bun from bun.lockb", () => {
    fs.writeFileSync(path.join(tmpDir, "bun.lockb"), "");
    expect(detectPackageManager(tmpDir).name).toBe("bun");
  });

  it("defaults to npm when no lockfile found", () => {
    expect(detectPackageManager(tmpDir).name).toBe("npm");
  });

  it("prefers pnpm over npm", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir).name).toBe("pnpm");
  });

  it("prefers pnpm over yarn", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir).name).toBe("pnpm");
  });
});

describe("readLocalDeps", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads dependencies and devDependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.0.0", "react-hook-form": "^7.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      }),
    );
    const deps = readLocalDeps(tmpDir);
    expect(deps.has("react")).toBe(true);
    expect(deps.has("react-hook-form")).toBe(true);
    expect(deps.has("typescript")).toBe(true);
    expect(deps.has("yup")).toBe(false);
  });

  it("returns empty set if no package.json", () => {
    expect(readLocalDeps(tmpDir).size).toBe(0);
  });

  it("handles package.json with no dependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test" }),
    );
    expect(readLocalDeps(tmpDir).size).toBe(0);
  });
});

describe("getRequiredDeps", () => {
  it("returns react-hook-form, @hookform/resolvers, tailwindcss, and yup for yup", () => {
    expect(getRequiredDeps("yup")).toEqual([
      "react-hook-form",
      "@hookform/resolvers",
      "tailwindcss",
      "yup",
    ]);
  });

  it("returns react-hook-form, @hookform/resolvers, tailwindcss, and zod for zod", () => {
    expect(getRequiredDeps("zod")).toEqual([
      "react-hook-form",
      "@hookform/resolvers",
      "tailwindcss",
      "zod",
    ]);
  });
});

describe("buildInstallCommand", () => {
  const npmPm: PackageManager = { name: "npm", installCmd: "npm install", devFlag: "--save-dev" };
  const pnpmPm: PackageManager = { name: "pnpm", installCmd: "pnpm add", devFlag: "--save-dev" };
  const yarnPm: PackageManager = { name: "yarn", installCmd: "yarn add", devFlag: "--dev" };
  const bunPm: PackageManager = { name: "bun", installCmd: "bun add", devFlag: "--dev" };

  it("builds correct npm command", () => {
    expect(buildInstallCommand(["react-hook-form", "yup"], npmPm))
      .toBe("npm install react-hook-form yup --save-dev");
  });

  it("builds correct pnpm command", () => {
    expect(buildInstallCommand(["react-hook-form"], pnpmPm))
      .toBe("pnpm add react-hook-form --save-dev");
  });

  it("builds correct yarn command", () => {
    expect(buildInstallCommand(["react-hook-form"], yarnPm))
      .toBe("yarn add react-hook-form --dev");
  });

  it("builds correct bun command", () => {
    expect(buildInstallCommand(["react-hook-form"], bunPm))
      .toBe("bun add react-hook-form --dev");
  });
});

describe("checkPeerDependencies", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns ok when all peer deps are installed", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: {
          "react-hook-form": "^7.0.0",
          "@hookform/resolvers": "^3.0.0",
          tailwindcss: "^4.0.0",
          yup: "^1.0.0",
        },
      }),
    );

    const result = await checkPeerDependencies("yup", tmpDir);
    expect(result.installed).toBe(true);
    expect(result.tailwindMissing).toBe(false);
  });

  it("skips prompts when all deps present", async () => {
    const onChoice = vi.fn();
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: {
          "react-hook-form": "^7.0.0",
          "@hookform/resolvers": "^3.0.0",
          tailwindcss: "^4.0.0",
          zod: "^3.0.0",
        },
      }),
    );

    await checkPeerDependencies("zod", tmpDir, { onChoice });
    expect(onChoice).not.toHaveBeenCalled();
  });

  it("calls onChoice when deps are missing", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: {} }),
    );

    const onChoice = vi.fn().mockResolvedValue(1);
    const installFn = vi.fn();

    const result = await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });
    expect(onChoice).toHaveBeenCalledOnce();
    expect(installFn).toHaveBeenCalledOnce();
    expect(result.installed).toBe(true);
    expect(result.tailwindMissing).toBe(true);
  });

  it("includes tailwindcss companion packages when tailwind is missing", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: {} }),
    );

    const onChoice = vi.fn().mockResolvedValue(1);
    const installFn = vi.fn();

    await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });

    const installedPkgs = installFn.mock.calls[0][0] as string[];
    expect(installedPkgs).toContain("tailwindcss");
    expect(installedPkgs).toContain("@tailwindcss/postcss");
    expect(installedPkgs).toContain("react-hook-form");
    expect(installedPkgs).toContain("yup");
  });

  it("does not include tailwindcss companion packages when tailwind is present", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: {
          tailwindcss: "^4.0.0",
        },
      }),
    );

    const onChoice = vi.fn().mockResolvedValue(1);
    const installFn = vi.fn();

    await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });

    const installedPkgs = installFn.mock.calls[0][0] as string[];
    expect(installedPkgs).not.toContain("@tailwindcss/postcss");
    expect(installedPkgs).toContain("react-hook-form");
    expect(installedPkgs).toContain("yup");
  });

  it("prints install command when user chooses option 2", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: {} }),
    );

    const onChoice = vi.fn().mockResolvedValue(2);
    const installFn = vi.fn();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });

    expect(installFn).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("npm install");
    expect(output).toContain("react-hook-form");
    expect(output).toContain("yup");

    consoleSpy.mockRestore();
  });

  it("sets tailwindMissing to false when tailwind is already installed", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: {
          tailwindcss: "^4.0.0",
        },
      }),
    );

    const onChoice = vi.fn().mockResolvedValue(1);
    const installFn = vi.fn();

    const result = await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });
    expect(result.tailwindMissing).toBe(false);
  });

  it("uses detected package manager for install", async () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: {} }),
    );

    const onChoice = vi.fn().mockResolvedValue(1);
    const installFn = vi.fn();

    await checkPeerDependencies("yup", tmpDir, { onChoice, installFn });

    const pm = installFn.mock.calls[0][1] as PackageManager;
    expect(pm.name).toBe("pnpm");
  });
});
