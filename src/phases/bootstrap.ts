import fs from "node:fs";
import path from "node:path";

export interface AgentConfig {
  $schema: string;
  paths: {
    formComponents: string;
    formsOutput: string;
    customValidators: string;
    schemas: string;
  };
  validationLibrary: string;
  cache: {
    path: string;
    ttlHours: number;
  };
  reactPersianForm: {
    repoOwner: string;
    repoName: string;
    ref: string;
    paths: {
      components: string;
      validators: string;
      utils: string;
    };
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
    schemas: "src/schemas",
  },
  validationLibrary: "yup",
  cache: {
    path: ".cache/rpf-listing.json",
    ttlHours: 24,
  },
  reactPersianForm: {
    repoOwner: "prhmhoseyni",
    repoName: "react-persian-form",
    ref: "main",
    paths: {
      components: "src/components",
      validators: "src/validators",
      utils: "src/utils",
    },
  },
  wizardComponent: {
    importPath: "~/components/atoms/Wizard/Wizard",
    typesImportPath: "~/components/atoms/Wizard/Wizard.types",
  },
};

const SCHEMA_URL =
  "https://raw.githubusercontent.com/prhmhoseyni/ai-form-agent/main/schemas/agent.config.schema.json";

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
  const configPath = path.join(projectRoot, "agent.config.json");

  if (fs.existsSync(configPath)) {
    console.log(`agent.config.json already exists at ${configPath}, skipping.`);
    return;
  }

  const config: AgentConfig = {
    $schema: SCHEMA_URL,
    ...DEFAULT_CONFIG,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`Created agent.config.json at ${configPath}`);

  ensureGitignore(projectRoot);
  console.log("Ensured .cache/ is in .gitignore");
}
