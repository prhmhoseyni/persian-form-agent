# persian-form-agent

CLI tool that uses Claude to generate React forms from Persian text descriptions.

## What it does

Given a plain-text Persian description of a form, `persian-form-agent` produces:

- A fully generated React form component (single-step or multi-step wizard)
- TypeScript interfaces for form data
- Yup validation schemas
- Components from [react-persian-form](https://github.com/prhmhoseyni/react-persian-form)

## How it works

```
Phase 0: Bootstrap     → agent.config.json
Phase 1: Analyze       → task-{id}.analysis.md (LLM-powered)
Phase 2: Review        → developer edits the .md file
Phase 3: Implement     → installs deps + generates code
```

**Every decision is traceable.** The agent never guesses — it checks the local project and react-persian-form via tools, and flags anything it can't resolve.

## Install

```bash
npx persian-form-agent init
```

## Usage

### 1. Bootstrap your project

```bash
npx persian-form-agent init
```

Creates `agent.config.json` in your project root with paths and configuration.

### 2. Write a task description

Create a text file with your form requirements in Persian:

```text
یک فرم ثبت نام ایجاد کن که شامل موارد زیر باشد:
firstName با عنوان "نام" که ضروری هست
lastName با عنوان "نام خانوادگی" که ضروری هست
cellphone با عنوان "شماره همراه" که ضروری است
```

### 3. Analyze

```bash
npx persian-form-agent analyze --input task.txt
```

Produces `task-{id}.analysis.md` — a structured, human-readable analysis file.

### 4. Review and edit

Open the `.analysis.md` file. Fix any `needs-decision` fields, set `overallStatus: ready` when satisfied.

### 5. Implement

```bash
npx persian-form-agent implement task-123
```

Installs needed components from react-persian-form and generates your form code.

## Configuration

`agent.config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/prhmhoseyni/persian-form-agent/main/schemas/agent.config.schema.json",
  "paths": {
    "formComponents": "src/components/form/fields",
    "formsOutput": "src/features/forms",
    "customValidators": "src/utils/validation/yup-extensions.ts",
    "schemas": "src/schemas"
  },
  "reactPersianForm": {
    "repoOwner": "prhmhoseyni",
    "repoName": "react-persian-form",
    "ref": "main"
  }
}
```

## Cache

File listings from react-persian-form are cached at `.cache/rpf-listing.json` (24h TTL). To invalidate, delete the file.

## License

MIT
