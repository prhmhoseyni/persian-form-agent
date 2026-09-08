import fs from "node:fs";
import path from "node:path";
import { promptChoice, checkPeerDependencies } from "./checkPeerDependencies.js";
import {
  detectImportAlias,
  type ImportAlias,
} from "../tools/detectImportAlias.js";
import {
  CONFIG_FILENAME,
  CONFIG_SCHEMA_URL,
  DEFAULT_CACHE_PATH,
} from "../config/agentConfig.js";

export interface AgentConfig {
  $schema: string;
  paths: {
    formComponents: string;
    formsOutput: string;
    customValidators: string;
    /**
     * Directory for standalone helper functions (digit conversion, formatters,
     * validators' internals) copied from react-persian-form's `templates/utils/`.
     */
    utils: string;
    schemas: string;
  };
  /**
   * Absolute-import alias for generated/installed code, detected from the
   * project's tsconfig on `init`. `null` → generated imports are relative.
   */
  importAlias?: ImportAlias | null;
  validationLibrary: string;
  cache: {
    path: string;
    ttlHours: number;
  };
  reactPersianForm: {
    repoOwner: string;
    repoName: string;
    ref: string;
  };
  wizardComponent: {
    importPath: string;
    typesImportPath: string;
  };
}

const DEFAULT_CONFIG: Omit<AgentConfig, "$schema"> = {
  paths: {
    formComponents: "src/components/form/fields",
    formsOutput: "src/features/forms",
    customValidators: "src/utils/validation/yup-extensions.ts",
    utils: "src/utils",
    schemas: "src/schemas",
  },
  importAlias: null,
  validationLibrary: "yup",
  cache: {
    path: DEFAULT_CACHE_PATH,
    ttlHours: 24,
  },
  reactPersianForm: {
    repoOwner: "prhmhoseyni",
    repoName: "react-persian-form",
    ref: "main",
  },
  wizardComponent: {
    importPath: "~/components/wizard/Wizard",
    typesImportPath: "~/components/wizard/Wizard.types",
  },
};

function ensureGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".cache/";

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.split("\n").some((line) => line.trim() === entry)) {
      fs.appendFileSync(gitignorePath, `\n${entry}\n`);
    }
  } else {
    fs.writeFileSync(gitignorePath, `${entry}\n`);
  }
}

export async function bootstrap(projectRoot: string): Promise<void> {
  const configPath = path.join(projectRoot, CONFIG_FILENAME);

  for (const name of [CONFIG_FILENAME, "agent.config.json"]) {
    const existing = path.join(projectRoot, name);
    if (fs.existsSync(existing)) {
      console.log(`${name} already exists at ${existing}, skipping.`);
      return;
    }
  }

  const config: AgentConfig = {
    $schema: CONFIG_SCHEMA_URL,
    ...DEFAULT_CONFIG,
  };

  // Detect an existing absolute-import alias so generated code can use it.
  config.importAlias = detectImportAlias(projectRoot, config.paths.formComponents);
  if (config.importAlias) {
    const { prefix, base } = config.importAlias;
    console.log(
      `✔ Import alias detected: "${prefix}/*" → ${base ? `${base}/` : "./"} (generated imports will use it)`,
    );
  } else {
    console.log(
      '• No import alias detected — generated imports will be relative. ' +
        'Add a "~/*" tsconfig path (and vite-tsconfig-paths under Vite) to change that.',
    );
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`✔ ${CONFIG_FILENAME} created`);

  ensureGitignore(projectRoot);
  console.log("✔ .gitignore updated");

  // Step 1: Ask which validation library to use
  const libChoice = await promptChoice(
    "Which validation library do you want to use?",
    ["yup", "zod"],
  );
  const validationLib = libChoice === 2 ? "zod" : "yup";

  // Update config with chosen validation library
  config.validationLibrary = validationLib;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // Step 2 & on: check & install peer dependencies
  await checkPeerDependencies(validationLib, projectRoot);
}
