import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import readline from "node:readline";

export interface PackageManager {
  name: string;
  installCmd: string;
  devFlag: string;
}

const LOCKFILE_ORDER: { file: string; pm: PackageManager }[] = [
  { file: "pnpm-lock.yaml", pm: { name: "pnpm", installCmd: "pnpm add", devFlag: "--save-dev" } },
  { file: "yarn.lock", pm: { name: "yarn", installCmd: "yarn add", devFlag: "--dev" } },
  { file: "bun.lockb", pm: { name: "bun", installCmd: "bun add", devFlag: "--dev" } },
];

const DEFAULT_PM: PackageManager = { name: "npm", installCmd: "npm install", devFlag: "--save-dev" };

const TAILWIND_COMPANION_PACKAGES = ["@tailwindcss/postcss"];

export function detectPackageManager(projectRoot: string): PackageManager {
  for (const { file, pm } of LOCKFILE_ORDER) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      return pm;
    }
  }
  return DEFAULT_PM;
}

export function readLocalDeps(projectRoot: string): Set<string> {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return new Set();
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps: Record<string, string> = pkg.dependencies || {};
  const devDeps: Record<string, string> = pkg.devDependencies || {};
  return new Set([...Object.keys(deps), ...Object.keys(devDeps)]);
}

export function getRequiredDeps(validationLibrary: string): string[] {
  return ["react-hook-form", "tailwindcss", validationLibrary];
}

export function promptChoice(question: string, options: string[]): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const optionLines = options.map((opt, i) => `  [${i + 1}] ${opt}`).join("\n");

  return new Promise((resolve) => {
    rl.question(`${question}\n${optionLines}\n\nChoice: `, (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);
      resolve(isNaN(num) || num < 1 || num > options.length ? 1 : num);
    });
  });
}

export function promptConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

export function installPackages(
  packages: string[],
  pm: PackageManager,
  projectRoot: string,
): void {
  const pkgArgs = packages.join(" ");
  const cmd = pm.devFlag
    ? `${pm.installCmd} ${pkgArgs} ${pm.devFlag}`
    : `${pm.installCmd} ${pkgArgs}`;
  console.log(`→ running: ${cmd}`);
  execSync(cmd, { cwd: projectRoot, stdio: "inherit" });
}

export function buildInstallCommand(packages: string[], pm: PackageManager): string {
  const pkgArgs = packages.join(" ");
  return pm.devFlag
    ? `${pm.installCmd} ${pkgArgs} ${pm.devFlag}`
    : `${pm.installCmd} ${pkgArgs}`;
}

export interface CheckResult {
  installed: boolean;
  tailwindMissing: boolean;
}

export interface CheckOptions {
  onChoice?: (question: string, options: string[]) => Promise<number>;
  installFn?: (packages: string[], pm: PackageManager, projectRoot: string) => void;
}

export async function checkPeerDependencies(
  validationLibrary: string,
  projectRoot: string,
  options?: CheckOptions,
): Promise<CheckResult> {
  const onChoice = options?.onChoice ?? promptChoice;
  const doInstall = options?.installFn ?? installPackages;

  const required = getRequiredDeps(validationLibrary);
  const localDeps = readLocalDeps(projectRoot);
  const missing = required.filter((name) => !localDeps.has(name));

  if (missing.length === 0) {
    console.log("✔ All required dependencies already installed");
    return { installed: true, tailwindMissing: false };
  }

  const pm = detectPackageManager(projectRoot);

  console.log(`\n⚠ Missing dependencies detected:`);
  for (const name of missing) {
    const label = name === "tailwindcss" ? `${name} (v4)` : name;
    console.log(`  - ${label}`);
  }

  const choice = await onChoice(
    `\nDo you want persian-form-agent to install these for you, or will you install them yourself?`,
    ["Install for me", "I'll install them myself"],
  );

  const allPkgs = [...missing];
  if (missing.includes("tailwindcss")) {
    allPkgs.push(...TAILWIND_COMPANION_PACKAGES);
  }

  if (choice === 1) {
    doInstall(allPkgs, pm, projectRoot);
    console.log("✔ Installed");
  } else {
    const cmd = buildInstallCommand(allPkgs, pm);
    console.log(`\nRun this command to install them:\n  ${cmd}\n`);
  }

  const tailwindMissing = missing.includes("tailwindcss");
  if (tailwindMissing) {
    console.log(`⚠ Tailwind v4 setup must still be completed manually:
  1. Add to your main CSS file: @import "tailwindcss";
  2. Configure postcss.config per Tailwind v4 docs
  Docs: https://tailwindcss.com/docs/installation

Once done, run:
  npx persian-form-agent verify-setup
`);
  }

  return { installed: true, tailwindMissing };
}
