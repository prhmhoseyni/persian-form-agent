# ارائه: `persian-form-agent` و `react-persian-form`

> از توضیح متنی فارسی تا یک فرم React کامل، قابل‌ردیابی و آماده‌ی استفاده.

این سند برای ارائه‌ی دو پروژه‌ی مکمل نوشته شده است:

| پروژه | نقش | جنس |
|---|---|---|
| **`react-persian-form`** | کتابخانه‌ی پایه: کامپوننت‌ها، ابزارها و اعتبارسنجی فرم‌های فارسی | Registry از فایل‌های کپی‌شونده (سبک shadcn/ui) |
| **`persian-form-agent`** | ابزار CLI که با کمک یک LLM از یک توضیح متنی فارسی، فرم React تولید می‌کند | خط لوله‌ی چهارمرحله‌ای انسان‑در‑حلقه |

`persian-form-agent` مصرف‌کننده‌ی `react-persian-form` است: هر جزئی که در فرم لازم می‌شود، از رجیستری `react-persian-form` گرفته و داخل پروژه‌ی مقصد کپی می‌شود.

---

## فهرست مطالب

1. [مسئله‌ای که حل می‌کنیم](#۱-مسئلهای-که-حل-میکنیم)
2. [نمای کلی معماری](#۲-نمای-کلی-معماری)
3. [`react-persian-form` — کتابخانه‌ی پایه](#۳-react-persian-form--کتابخانهی-پایه)
   - [مدل رجیستری](#۳۱-مدل-رجیستری-چرا-npm-نه)
   - [لایه‌ی `utils`](#۳۲-لایهی-utils--توابع-مستقل)
   - [لایه‌ی `validation`](#۳۳-لایهی-validation--اعتبارسنجی-فارسی)
   - [لایه‌ی `component-core`](#۳۴-لایهی-component-core--زیرساخت-اینپوت)
   - [کامپوننت‌های آماده](#۳۵-کامپوننتهای-آماده-text-cellphone-amount)
   - [لایه‌ی `theme`](#۳۶-لایهی-theme)
   - [CLI به‌نام `persian-form`](#۳۷-cli-بهنام-persian-form)
   - [Toolchain مونوریپو](#۳۸-toolchain-مونوریپو)
4. [`persian-form-agent` — عامل تولید فرم](#۴-persian-form-agent--عامل-تولید-فرم)
   - [فلسفه‌ی طراحی](#۴۱-فلسفهی-طراحی)
   - [دستورات CLI](#۴۲-دستورات-cli)
   - [`persian-form-agent.config.json`](#۴۳-persian-form-agentconfigjson--تمام-فیلدها)
   - [فاز ۰: `init` (Bootstrap)](#۴۴-فاز-۰-init--bootstrap)
   - [فاز ۱: `analyze`](#۴۵-فاز-۱-analyze)
   - [مدل داده‌ی `AnalysisData`](#۴۶-مدل-دادهی-analysisdata)
   - [فایل `task-{id}.analysis.md`](#۴۷-فایل-task-idanalysismd)
   - [فاز ۲: بازبینی انسانی](#۴۸-فاز-۲-بازبینی-انسانی)
   - [فاز ۳: `implement`](#۴۹-فاز-۳-implement)
   - [مدیریت Import Alias](#۴۱۰-مدیریت-import-alias)
   - [پیکربندی LLM](#۴۱۱-پیکربندی-llm)
   - [کش](#۴۱۲-کش)
5. [یک نمونه‌ی کامل (End‑to‑End)](#۵-یک-نمونهی-کامل-endtoend)
6. [تصمیم‌های طراحی و نکات ارائه](#۶-تصمیمهای-طراحی-و-نکات-ارائه)
7. [محدودیت‌های نسخه‌ی فعلی و نقشه‌ی راه](#۷-محدودیتهای-نسخهی-فعلی-و-نقشهی-راه)
8. [پیوست: پشته‌ی فناوری](#۸-پیوست-پشتهی-فناوری)

---

## ۱. مسئله‌ای که حل می‌کنیم

ساختن فرم فارسی «درست» در React پر از کار تکراری و ریز است:

- **RTL و جهت‌دهی:** لِیبل، پیام خطا، adornmentها و جهت خودِ اینپوت (متن راست‌چین، شماره موبایل چپ‌چین).
- **ارقام فارسی:** کاربر باید ارقام فارسی ببیند، اما مقدار ذخیره‌شده در فرم باید انگلیسیِ خام باشد تا اعتبارسنجی و ارسال به سرور درست کار کند.
- **قالب‌بندی هنگام تایپ:** جداکننده‌ی هزارگان برای مبلغ، گروه‌بندی شماره موبایل — همه باید **بدون پریدن مکان‌نما** انجام شوند.
- **اعتبارسنجی بومی:** موبایل ایرانی، کد ملی (با الگوریتم checksum)، کد پستی، فقط حروف فارسی، نیم‌فاصله.
- **پیام‌های خطای فارسی:** یک‌دست، با ارقام فارسی داخل خود پیام («حداکثر کاراکتر ورودی می‌تواند ۵۰ باشد.»).

`react-persian-form` این‌ها را یک‌بار و درست حل می‌کند. `persian-form-agent` مرحله‌ی بعد را حذف می‌کند: نوشتن دستیِ کامپوننت فرم، اسکیمای اعتبارسنجی و تایپ‌ها از روی نیازمندی‌ها.

---

## ۲. نمای کلی معماری

```
                                توضیح فارسی فرم (task.txt)
                                          │
                                          ▼
┌─────────────────────────  persian-form-agent  ──────────────────────────┐
│                                                                        │
│  فاز ۰: init        →  persian-form-agent.config.json  + تشخیص alias + نصب پیش‌نیازها  │
│  فاز ۱: analyze     →  task-{id}.analysis.md   (توسط LLM + ابزارها)      │
│  فاز ۲: review      →  توسعه‌دهنده فایل .md را اصلاح و تأیید می‌کند         │
│  فاز ۳: implement   →  نصب اجزا از رجیستری + تولید کد فرم                 │
│                                                                        │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  fetch از raw.githubusercontent.com
                                ▼
                    ┌──────────  react-persian-form  ──────────┐
                    │  registry/registry.json                  │
                    │  templates/utils/**                      │
                    │  templates/validation/yup/**             │
                    │  templates/components/**                 │
                    │  templates/theme/**                      │
                    └──────────────────────────────────────────┘
                                │
                                ▼
                   پروژه‌ی مقصد (React + Tailwind v4)
       src/components/form/fields/**   ← کامپوننت‌های کپی‌شده
       src/utils/**                    ← توابع کمکی
       src/utils/validation/**         ← متدهای yup فارسی
       src/features/forms/**           ← فرم‌های تولیدشده
       src/schemas/**                  ← اینترفیس‌های TypeScript
```

نکته‌ی کلیدی: **هیچ‌کدام از این دو پروژه یک وابستگی زمان‌اجرا (runtime dependency) به پروژه‌ی شما اضافه نمی‌کنند.** کد داخل مخزن شما کپی می‌شود و مال شماست.

---

## ۳. `react-persian-form` — کتابخانه‌ی پایه

یک **مونوریپو** (pnpm + Turborepo) با این ساختار:

```
react-persian-form/
├── apps/
│   └── playground/          # اپ Vite + React 19 برای تست بصری
├── packages/
│   ├── cli/                 # ابزار CLI: persian-form
│   ├── tsconfig/            # کانفیگ‌های مشترک TypeScript
│   └── biome-config/        # کانفیگ مشترک Biome (lint/format)
├── registry/
│   └── registry.json        # مانیفست رجیستری
└── templates/               # کدِ منبعِ کپی‌شونده
    ├── utils/
    ├── validation/yup/
    ├── components/
    └── theme/
```

### ۳.۱ مدل رجیستری (چرا npm نه؟)

`react-persian-form` مثل `shadcn/ui` کار می‌کند: به‌جای انتشار یک پکیج، **کدِ منبع را در قالب فایل‌های کپی‌شونده** ارائه می‌دهد.

فایل `registry/registry.json` مانیفست است. هر ورودی یک «لایه» را توصیف می‌کند:

```jsonc
{
  "text": {
    "type": "component",
    "description": "کامپوننت اینپوت متن ساده با نمایش ارقام فارسی.",
    "files": ["components/text/text.tsx", "components/text/index.ts"],
    "dependencies": ["react-hook-form"],          // پکیج‌های npm
    "registryDependencies": ["utils", "component-core"]  // لایه‌های دیگر رجیستری
  }
}
```

| فیلد | معنی |
|---|---|
| `type` | `utils` \| `validation` \| `theme` \| `component-core` \| `component` |
| `description` | توضیح فارسی، در خروجی `list` و تحلیل عامل استفاده می‌شود |
| `files` | مسیرها نسبت به `templates/` — همین‌ها کپی می‌شوند |
| `dependencies` | پکیج‌های npm که این لایه لازم دارد |
| `registryDependencies` | لایه‌های دیگری که باید همراهش نصب شوند (وابستگی گذرا) |

**مزیت برای عامل:** یک درخواست HTTP به `raw.githubusercontent.com` برای گرفتن مانیفست کافی است — نه پیمایش درخت مخزن، نه محدودیت نرخ ۶۰ درخواست در ساعتِ GitHub API، نه خرابی وقتی ساختار پوشه‌ها عوض می‌شود.

لایه‌های فعلی رجیستری:

| کلید | نوع | توضیح |
|---|---|---|
| `utils` | utils | تبدیل ارقام، اعتبارسنجی موبایل و کد ملی، قالب‌بندی مبلغ و موبایل |
| `validation-yup` | validation | متدهای سفارشی yup فارسی + `setLocale` + `useYupValidationResolver` |
| `theme` | theme | توکن‌های Tailwind v4 (رنگ، تایپوگرافی، سایه) |
| `component-core` | component-core | اینترفیس `Formatter` + کامپوننت پایه‌ی `Input` |
| `text` | component | اینپوت متن با نمایش ارقام فارسی |
| `cellphone` | component | اینپوت شماره موبایل با گروه‌بندی و ارقام فارسی |
| `amount` | component | اینپوت مبلغ با جداکننده‌ی هزارگان |

### ۳.۲ لایه‌ی `utils` — توابع مستقل

بدون هیچ وابستگی، قابل تست جداگانه:

| تابع | کار |
|---|---|
| `toPersianDigits` | `"09121234567"` → `"۰۹۱۲۱۲۳۴۵۶۷"` |
| `toEnglishDigits` | معکوس، ورودی خام کاربر را نرمال می‌کند |
| `isValidMobile` | موبایل ایرانی: `^(00989|09|\+989|9)\d{9}$` |
| `checkNationalId` | کد ملی ۱۰ رقمی با الگوریتم checksum و رد کردن ارقام تکراری |
| `formatAmount` | `1234567` → `"۱,۲۳۴,۵۶۷"` |
| `formatCellphoneNumber` | `"09121234567"` → `"۰۹۱۲ ۱۲۳ ۴۵۶۷"` |

### ۳.۳ لایه‌ی `validation` — اعتبارسنجی فارسی

فایل `templates/validation/yup/index.ts` سه کار می‌کند:

1. **متدهای سفارشی yup** را با `yup.addMethod` اضافه می‌کند و با `declare module "yup"` تایپشان را هم گسترش می‌دهد:

```ts
declare module "yup" {
  interface StringSchema {
    cellPhoneNumber(message?: string): this;
  }
}

yup.addMethod<yup.StringSchema>(yup.string, "cellPhoneNumber",
  function (message = "شماره موبایل وارد شده معتبر نمی‌باشد.") {
    return this.test("cellPhoneNumber", message, (value) => {
      if (value == null || value === "") return true; // خالی بودن با .required() کنترل می‌شود
      return isValidMobile(value);
    });
  });
```

   متدهای موجود: `email`, `cellPhoneNumber`, `nationalId`, `postalCode`,
   `onlyPersianCharacters`, `onlyPersianCharactersAndDigits`, `space`, `halfSpace`.

2. **`yup.setLocale`** با پیام‌های فارسی و ارقام فارسی داخل پیام:

```ts
string: {
  max: ({ max }) => `حداکثر کاراکتر ورودی می‌تواند ${toPersianDigits(max)} باشد.`,
}
```

3. **`useYupValidationResolver`** را صادر می‌کند — یک wrapper نازک روی `@hookform/resolvers/yup` که فرم‌های تولیدشده مصرف می‌کنند.

### ۳.۴ لایه‌ی `component-core` — زیرساخت اینپوت

دو تکه:

**`Formatter` (قرارداد):**

```ts
interface Formatter {
  format(state: FormatterState): FormatterState;  // مقدار خامِ فرم → نمایش
  parse(value: string): string;                   // مقدار DOM → ذخیره در فرم
}
```

**`Input<T>` (کامپوننت پایه‌ی primitive):**

- روی `react-hook-form` سوار است (`useController` + `useWatch`).
- با `useLayoutEffect` بعد از هر قالب‌بندی، **مکان‌نما را جبران می‌کند** تا هنگام تایپِ عددِ جداکننده‌دار، cursor نپرد.
- از IME (ورودی ترکیبی) آگاه است.
- `label`, `helperText`, `startAdornment`, `endAdornment`, نمایش خطا و کلاس‌های حالت خطا را مدیریت می‌کند.
- `dir="rtl"` پیش‌فرض، قابل override.

کامپوننت‌های Concrete فقط یک `formatter` مناسب به `Input` می‌دهند.

### ۳.۵ کامپوننت‌های آماده (`text`, `cellphone`, `amount`)

همه یک الگو دارند: generic روی `<T extends FieldValues>`، props شامل `name` (به‌صورت `Path<T>`)، `control` (به‌صورت `Control<T>`)، `label` و…

| کامپوننت | نمایش | مقدار ذخیره‌شده در فرم | `dir` |
|---|---|---|---|
| `Text` | ارقام فارسی | ارقام انگلیسی خام | `rtl` |
| `Cellphone` | `"۰۹۱۲ ۱۲۳ ۴۵۶۷"` | `"09121234567"` (حداکثر ۱۱ رقم) | `ltr` |
| `Amount` | `"۱,۲۳۴,۵۶۷"` + adornment «ریال» | `"1234567"` (رشته‌ی رقمی خام) | `ltr` |

هر کامپوننت یک `index.ts` دارد که هم یک default با `memo()` و هم نسخه‌ی generic خام را با نام PascalCase صادر می‌کند:

```ts
// components/text/index.ts
export { default, Text } from "./text";
export type { TextProps } from "./text";
```

> نکته‌ی مهم برای کدِ تولیدی: `memo()` پارامتر جنریک `<T>` را پاک می‌کند، پس فرم‌های تولیدشده همیشه **نسخه‌ی نام‌دار** (`import { Text }`) را import می‌کنند، نه default را.

### ۳.۶ لایه‌ی `theme`

یک فایل CSS با توکن‌های Tailwind v4 (`persian-form-theme.css`) — رنگ‌ها (`text-prose-primary`, `border-danger`, `bg-background-primary`)، تایپوگرافی (`text-label3`, `text-caption2`) و سایه‌ی focus. کامپوننت‌ها به این کلاس‌ها وابسته‌اند، برای همین `implement` وجود `@import "tailwindcss"` را در پروژه‌ی مقصد بررسی می‌کند.

### ۳.۷ CLI به‌نام `persian-form`

یک ابزار مستقل داخل مونوریپو (`packages/cli`) برای مصرف دستیِ رجیستری:

| دستور | کار |
|---|---|
| `persian-form init` | ساخت `persian-form.json` (مسیرهای مقصد در پروژه) |
| `persian-form list [--type <t>]` | فهرست ورودی‌های رجیستری |
| `persian-form add <components...> [--install]` | کپی لایه‌ها + وابستگی‌های گذرا به پروژه، با حل مقصد بر اساس prefix (`utils/`، `validation/`، `components/_core/`، `components/`، `theme/`) |

> `persian-form-agent` مستقیماً از رجیستری و `templates/` می‌خواند و به این CLI وابسته نیست؛ این CLI مسیر «انسانی» است.

### ۳.۸ Toolchain مونوریپو

- **مدیر پکیج:** pnpm (از طریق `corepack`)
- **ارکستریتور:** Turborepo (`pnpm turbo dev|build|lint|test|format`)
- **Lint/Format:** Biome ۱.۹ — دو فاصله، عرض خط ۱۰۰، دابل‌کوت، سمی‌کالن
- **تست:** Vitest ۴ — فایل‌های تست کنار پیاده‌سازی (`foo.ts` + `foo.test.ts`) و **از `files` رجیستری حذف شده‌اند** تا هرگز به پروژه‌ی مصرف‌کننده کپی نشوند
- **Playground:** Vite + React 19 + Tailwind CSS 4

---

## ۴. `persian-form-agent` — عامل تولید فرم

یک ابزار CLI (Node ≥ ۱۸، ESM، TypeScript) که خط لوله‌ی زیر را اجرا می‌کند:

```
فاز ۰: Bootstrap   → persian-form-agent.config.json
فاز ۱: Analyze     → task-{id}.analysis.md   (LLM‑powered)
فاز ۲: Review      → توسعه‌دهنده فایل .md را اصلاح می‌کند
فاز ۳: Implement   → نصب اجزا + تولید کد
```

### ۴.۱ فلسفه‌ی طراحی

1. **هرگز حدس نزن.** LLM حق ندارد نام کامپوننت یا اعتبارسنج را از حافظه بسازد. باید با ابزار، وجودش را ابتدا در پروژه‌ی محلی و بعد در `react-persian-form` بررسی کند.
2. **هر تصمیم قابل‌ردیابی است.** خروجی فاز ۱ یک فایل `.md` خوانا برای انسان است که برای هر فیلد `rawRule` (تکه‌متن اصلی فارسی)، `confidence`، `warnings` و منبع کامپوننت را نگه می‌دارد.
3. **انسان در حلقه.** فایل تحلیل قبل از تولید کد باید بازبینی و با `overallStatus: ready` تأیید شود. عامل هر ابهامی را با `needs-decision` علامت می‌زند، نه با یک عددِ ساختگی.
4. **محلی به‌صورت پیش‌فرض.** بدون هیچ تنظیمی، به یک سرور محلی سازگار با Anthropic وصل می‌شود — بدون هزینه.
5. **بدون side-effect ناخواسته.** عامل هرگز `tsconfig` یا کانفیگ باندلر شما را ویرایش نمی‌کند؛ فقط می‌خواند.

### ۴.۲ دستورات CLI

| دستور | فاز | کار |
|---|---|---|
| `persian-form-agent init [-p <path>]` | ۰ | ساخت `persian-form-agent.config.json`، تشخیص alias، پرسش کتابخانه‌ی اعتبارسنجی، بررسی/نصب پیش‌نیازها |
| `persian-form-agent analyze -i <file> [--wizard]` | ۱ | تحلیل توضیح فارسی و تولید `task-{id}.analysis.md` |
| `persian-form-agent implement <taskId>` | ۳ | نصب اجزای لازم از رجیستری + تولید کد فرم |
| `persian-form-agent verify-llm` | — | تست دود (smoke test) اتصال به endpoint مدل |
| `persian-form-agent verify-setup` | — | بررسی درست بودن نصب Tailwind v4 |

همه‌ی دستورها `-p, --path <path>` را می‌پذیرند (ریشه‌ی پروژه‌ی مقصد؛ پیش‌فرض `.`).

### ۴.۳ `persian-form-agent.config.json` — تمام فیلدها

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/prhmhoseyni/persian-form-agent/main/schemas/persian-form-agent.config.schema.json",

  "paths": {
    "formComponents":   "src/components/form/fields",              // مقصد کامپوننت‌های کپی‌شده
    "formsOutput":      "src/features/forms",                      // مقصد فرم‌های تولیدشده
    "customValidators": "src/utils/validation/yup-extensions.ts",  // پوشه‌ی والدش = مقصد فایل‌های validation
    "utils":            "src/utils",                               // مقصد توابع کمکی
    "schemas":          "src/schemas"                              // مقصد اینترفیس‌های تولیدشده
  },

  "importAlias": { "prefix": "~", "base": "src" },   // یا null → importهای نسبی

  "validationLibrary": "yup",                        // اسکیمای فعلی فقط "yup" را می‌پذیرد

  "cache": {
    "path": ".cache/persian-form-agent.rpf-listing.json",
    "ttlHours": 24
  },

  "reactPersianForm": {
    "repoOwner": "prhmhoseyni",
    "repoName":  "react-persian-form",
    "ref":       "main"                              // برانچ/تگ/SHA قابل pin کردن
  },

  "wizardComponent": {
    "importPath":      "~/components/wizard/Wizard",
    "typesImportPath": "~/components/wizard/Wizard.types"
  }
}
```

اسکیمای کامل JSON در [`schemas/persian-form-agent.config.schema.json`](../schemas/persian-form-agent.config.schema.json) است و `$schema` باعث autocomplete در ویرایشگر می‌شود.

### ۴.۴ فاز ۰: `init` (Bootstrap)

`src/phases/bootstrap.ts` این کارها را انجام می‌دهد:

1. اگر `persian-form-agent.config.json` هست، رد می‌شود؛ وگرنه با مقادیر پیش‌فرض می‌سازد.
2. **تشخیص Import Alias:** `tsconfig.json` / `jsconfig.json` را می‌خواند (با دنبال‌کردن `extends` و `references`) و دنبال یک path مثل `"~/*": ["src/*"]` می‌گردد که پوشه‌های تولیدی را پوشش دهد. زیر Vite، فقط وقتی می‌پذیرد که `vite-tsconfig-paths` یا یک `resolve.alias` متناظر واقعاً آن را حل کند.
3. `.gitignore` را با `.cache/` به‌روز می‌کند.
4. **پرسش کتابخانه‌ی اعتبارسنجی:** `yup` یا `zod` (نتیجه در `validationLibrary` ذخیره می‌شود).
5. **بررسی پیش‌نیازها** (`checkPeerDependencies`): پکیج‌های لازم را با `package.json` مقایسه می‌کند — `react-hook-form`, `@hookform/resolvers`, `tailwindcss`, و خودِ کتابخانه‌ی اعتبارسنجی. مدیر پکیج را از روی lockfile تشخیص می‌دهد (`pnpm`/`yarn`/`bun`/`npm`) و یا برایتان نصب می‌کند یا دستور نصب را چاپ می‌کند. برای Tailwind، `@tailwindcss/postcss` را هم اضافه می‌کند و یادآوری می‌کند که `@import "tailwindcss"` را دستی اضافه کنید.

### ۴.۵ فاز ۱: `analyze`

`src/phases/analyze.ts`:

1. `.env` را از ریشه‌ی پروژه‌ی مقصد و cwd بارگذاری می‌کند (بدون clobber کردن متغیرهای موجود).
2. `persian-form-agent.config.json` را می‌خواند.
3. متن task را می‌خواند؛ اگر `--wizard` داده شده، یک hint به پیام کاربر اضافه می‌کند.
4. یک **حلقه‌ی ابزارِ LLM** (`runToolLoop`، حداکثر ۲۰ تکرار) با این اجزا اجرا می‌کند:

**System prompt (`src/prompts/analyzeTaskPrompt.ts`) — محدودیت‌های سخت:**

- هرگز نام کامپوننت/اعتبارسنج را از حافظه حدس نزن؛ همیشه با ابزار بررسی کن.
- ترتیب حل کامپوننت هر فیلد: (الف) کامپوننت‌های محلی پروژه → (ب) `react-persian-form` → (ج) اگر هیچ‌کدام، `componentStatus: "needs-decision"`.
- هرگز فیلدی که در متن نیست را نساز.
- اگر قاعده‌ی اعتبارسنجی مبهم است (مثلاً «طول مناسب»)، عدد نساز — warning بده.
- اگر شناسه‌ی انگلیسی صریح در متن هست، عیناً استفاده کن (`nameSource: "explicit-in-task"`)؛ وگرنه از لِیبل فارسی یک نام camelCase بساز (`"auto-generated"`).
- در این MVP اعتبارسنجی شرطی (`yup.when()`) ممنوع است.

**چهار ابزار (`src/tools/analyzeToolDefinitions.ts`):**

| ابزار | کار |
|---|---|
| `listLocalProjectComponents` | فهرست فایل‌های کامپوننت در `paths.formComponents` پروژه‌ی مقصد |
| `listReactPersianFormFiles` | فهرست آیتم‌های یک دسته (`components` \| `validators` \| `utils`) از رجیستری — با کش محلی |
| `readComponentSource` | خواندن سورس خام یک فایل (محلی یا از `react-persian-form`) برای دیدن props/امضا قبل از تصمیم |
| `writeAnalysisFile` | نوشتن `task-{id}.analysis.md` نهایی از طریق renderer قطعیِ markdown |

5. هنگام `writeAnalysisFile`، عامل `overallStatus` را **خودش با `computeOverallStatus` حساب می‌کند** (نه LLM): اگر هر فیلدی `needs-decision` یا `confidence: "low"` داشته باشد → `needs-review`، وگرنه `ready`.

### ۴.۶ مدل داده‌ی `AnalysisData`

از [`src/types.ts`](../src/types.ts):

```ts
interface AnalysisData {
  taskId: string;
  formName: string;              // PascalCase، از توضیح استخراج می‌شود
  formType: "single" | "wizard";
  overallStatus: "ready" | "needs-review";
  steps: WizardStep[];           // فرم تک‌مرحله‌ای = یک step با stepIndex: 0
}

interface WizardStep {
  stepIndex: number;
  componentName?: string;
  fields: FormField[];
}

interface FormField {
  name: string;                  // شناسه‌ی camelCase
  label: string;                 // لِیبل فارسی
  required: boolean;
  nameSource: "explicit-in-task" | "auto-generated";
  mappedComponent: string | null;
  componentSource: "local" | "react-persian-form" | "project-custom" | "unresolved";
  componentStatus: "resolved-local" | "needs-installation" | "needs-decision" | "custom-confirmed";
  mappedValidators: string[];    // مثل ["required", "max:50", "cellPhoneNumber"]
  rawRule: string;               // تکه‌متن فارسی اصلیِ این فیلد
  confidence: "high" | "medium" | "low";
  warnings: string[];
  customComponentPath: string | null;
  customize?: string;            // بلوک کد اختیاری (فعلاً استفاده نمی‌شود)
}
```

نام‌گذاری اعتبارسنج‌ها: `required`, `trim`, `onlyPersianCharactersAndDigits`, `max:N`,
`min:N`, `cellPhoneNumber`, `email`, `space:N`, `halfSpace:N`.

### ۴.۷ فایل `task-{id}.analysis.md`

renderer قطعی (`src/parsers/analysisMarkdown.ts`) این خروجی را تولید می‌کند و همان parser دوباره آن را می‌خواند:

```markdown
---
taskId: "123"
formName: RegistrationForm
formType: single
overallStatus: needs-review
---

# Form: RegistrationForm

### Field: firstName
- label: نام
- required: true
- nameSource: explicit-in-task
- mappedComponent: text
- componentSource: react-persian-form
- componentStatus: needs-installation
- mappedValidators: required, trim, max:50
- rawRule: firstName با عنوان "نام" که ضروری هست
- confidence: high
- warnings: (none)

### Field: cellphone
- label: شماره همراه
- required: true
- ...
- componentStatus: needs-decision
- warnings: چند کامپوننت ممکن پیدا شد، توسعه‌دهنده باید انتخاب کند
```

برای فرم wizard، هر مرحله زیر `## Step N: ComponentName` می‌آید.

### ۴.۸ فاز ۲: بازبینی انسانی

توسعه‌دهنده فایل `.md` را باز می‌کند و:

- هر فیلد `needs-decision` را حل می‌کند (نام کامپوننت درست را می‌گذارد، `componentStatus` را عوض می‌کند).
- هشدارها را بررسی و اعداد اعتبارسنجی مبهم را نهایی می‌کند.
- وقتی راضی بود، در frontmatter `overallStatus: ready` می‌گذارد.

این فایل قرارداد بین انسان و ماشین است — کاملاً قابل diff و review در Git.

### ۴.۹ فاز ۳: `implement`

`src/phases/install.ts` → `implement(taskId, projectRoot)`:

**گیت‌ها (اگر رد شوند، متوقف می‌شود):**

1. `verifyTailwindSetup` — باید `@import "tailwindcss"` در یکی از فایل‌های CSS اصلی باشد.
2. `overallStatus` باید دقیقاً `"ready"` باشد.

**۳.۱ — `installComponents`:**

1. رجیستری را fetch می‌کند.
2. `collectRegistryKeys` — کلیدهای ریشه را جمع می‌کند: `mappedComponent` هر فیلدِ `needs-installation` که منبعش `react-persian-form` است، به‌علاوه‌ی بسته‌ی `validation` مطابق `validationLibrary` (چون فرم تولیدشده `useYupValidationResolver` و `setLocale` را از آن import می‌کند).
3. `resolveTransitiveKeys` — با پیمایش `registryDependencies`، وابستگی‌ها را باز می‌کند و **به‌ترتیب dependency-first** برمی‌گرداند (با محافظ چرخه).
4. برای هر فایل: مسیر `templates/<prefix>/…` را با `mapTemplatePathToLocal` به مسیر پروژه نگاشت می‌کند (`components/` → `paths.formComponents`، `validation/` → پوشه‌ی `customValidators`، `utils/` → `paths.utils`؛ بقیه مثل `theme/` نصب نمی‌شوند).
5. اگر فایل از قبل هست، دست نمی‌زند؛ وگرنه سورس خام را fetch و **importهای نسبی داخلش را بازنویسی می‌کند** (`rewriteRelativeImports`) تا بعد از پخش‌شدن `templates/` روی پوشه‌های مختلف پروژه، همچنان resolve شوند — با alias همه به `<alias>/…` تبدیل می‌شوند، بدون alias عمق نسبی درست محاسبه می‌شود.
6. `persian-form-agent.installation-log.json` را می‌نویسد: `taskId`, `installedAt`, `ref`, کلیدهای رجیستری، فایل‌های نوشته‌شده، و پکیج‌های npm که لایه‌های نصب‌شده اعلام کرده‌اند (اگر نصب نیستند، دستور نصب چاپ می‌شود).

**۳.۲ — `generateCode` (`src/phases/generateCode.ts`):**

قطعی، بدون LLM. از روی `AnalysisData`:

- **فرم تک‌مرحله‌ای** → یک فایل `<FormName>.tsx`:
  - `useForm<FormVo>` + `useYupValidationResolver(yup.object({ … }))`
  - زنجیره‌ی yup برای هر فیلد از روی `mappedValidators` ساخته می‌شود (`buildYupValidatorChain`): `required` → `.required()`، `max:50` → `.max(50)`، `cellPhoneNumber` → `.cellPhoneNumber()` و…؛ اگر فیلد `required` نباشد، `.required()` حذف می‌شود.
  - JSX: `<Text label="…" name="…" control={formMethods.control} />` — اگر کامپوننت حل نشده باشد، یک کامنت `{/* TODO */}` می‌گذارد.
  - import کامپوننت‌ها با نسخه‌ی **نام‌دار** و از مسیر alias یا نسبی.
- **فرم wizard** → یک فایل به‌ازای هر مرحله (`props: WizardStepProps<FormVo>` که `props.dispatch(values)` را صدا می‌زند) + یک فایل والد که `<Wizard steps={[…]} />` را رندر می‌کند (مسیر import از `wizardComponent` کانفیگ).
- **تایپ‌ها** → `src/schemas/<FormName>FormVo.ts` با یک اینترفیس که همه‌ی فیلدها را جمع می‌کند.

### ۴.۱۰ مدیریت Import Alias

`src/tools/detectImportAlias.ts` — هرگز alias نمی‌سازد، فقط می‌خواند:

- زنجیره‌ی `tsconfig.json` → `tsconfig.app.json` → `tsconfig.base.json` → `jsconfig.json` را با پشتیبانی JSONC (کامنت و کامای انتهایی) می‌خواند و `extends`/`references` را دنبال می‌کند.
- ورودی‌های `compilerOptions.paths` که به `/*` ختم می‌شوند و **پوشه‌های تولیدی را پوشش می‌دهند** را کاندید می‌کند؛ رتبه‌بندی: عمیق‌ترین `base` که هنوز پوشش می‌دهد، سپس ترجیح `~` > `@` > `$`.
- زیر Vite: فقط اگر `vite-tsconfig-paths` نصب/wire شده باشد یا یک `resolve.alias` دستیِ متناظر در کانفیگ باشد، می‌پذیرد؛ وگرنه `null` (import نسبی) تا build نشکند.
- `importSpecifier(alias, target, fromDir)` — اگر alias پوشش دهد `~/rel`، وگرنه مسیر نسبی با پیشوند `./` یا `../`.

### ۴.۱۱ پیکربندی LLM

فاز `analyze` تنها بخش LLM-محور است. کلاینت با **Anthropic SDK** ساخته می‌شود اما به **هر endpoint سازگار با Anthropic Messages API** وصل می‌شود.

`src/config/env.ts` → `resolveLlmConfig()`:

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `LLM_BASE_URL` | `http://127.0.0.1:9655` | فقط origin؛ SDK خودش `/v1/messages` را اضافه می‌کند |
| `LLM_MODEL` | `deepseek-chat` | مدلی که در هر درخواست فرستاده می‌شود |
| `LLM_API_KEY` | `dummy` | هدر `x-api-key`؛ سرور محلی نادیده‌اش می‌گیرد |

> `LLM_*` تنها منبع پیکربندی است. متغیرهای محیطیِ `ANTHROPIC_*` **عمداً نادیده گرفته می‌شوند** تا ابزار به‌صورت پیش‌فرض محلی بماند.

**حالت پیش‌فرض (بدون هزینه):** یک سرور محلی FreeDeepseekAPI که روی `127.0.0.1:9655` گوش می‌دهد و `POST /v1/messages` را ارائه می‌کند. با `persian-form-agent verify-llm` تست می‌شود (endpoint، مدل، و پاسخ مدل به «Say hello in Persian.» را چاپ می‌کند).

**استفاده از Anthropic واقعی:**

```bash
LLM_BASE_URL=https://api.anthropic.com
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514
```

`.env` از ریشه‌ی پروژه‌ی مقصد (کنار `persian-form-agent.config.json`) و cwd به‌صورت خودکار بارگذاری می‌شود.

### ۴.۱۲ کش

فهرست رجیستریِ `react-persian-form` در `.cache/persian-form-agent.rpf-listing.json` کش می‌شود (TTL پیش‌فرض ۲۴ ساعت، از `cache.ttlHours`). کش شامل `meta` (owner/repo/ref/fetchedAt) است و اگر هر کدام از این‌ها با کانفیگ نخوانَد یا کهنه باشد، دوباره fetch می‌شود. برای باطل‌کردن دستی، فایل را پاک کنید.

---

## ۵. یک نمونه‌ی کامل (End‑to‑End)

**۱) توضیح فرم — `task.txt`:**

```text
یک فرم ثبت نام ایجاد کن که شامل موارد زیر باشد:
firstName با عنوان "نام" که ضروری هست
lastName با عنوان "نام خانوادگی" که ضروری هست
cellphone با عنوان "شماره همراه" که ضروری است
```

**۲) راه‌اندازی پروژه:**

```bash
npx persian-form-agent init
```

خروجی: `persian-form-agent.config.json` ساخته شد · alias `~/*` → `src/` تشخیص داده شد · کتابخانه‌ی اعتبارسنجی: yup · پیش‌نیازها نصب شدند.

**۳) تحلیل (سرور LLM محلی باید بالا باشد):**

```bash
npx persian-form-agent verify-llm      # اختیاری: تست اتصال
npx persian-form-agent analyze --input task.txt
```

خروجی: `task-<id>.analysis.md` با سه فیلد؛ `firstName`/`lastName` با `confidence: high` و `componentStatus: needs-installation`، `cellphone` → `mappedComponent: cellphone`.

**۴) بازبینی:** فایل `.md` را باز کنید، اعداد `max:` را نهایی کنید، `overallStatus: ready` بگذارید.

**۵) پیاده‌سازی:**

```bash
npx persian-form-agent implement <id>
```

خروجی:

```
+ write  src/utils/to-persian-digits.ts
+ write  src/utils/to-english-digits.ts
+ write  src/utils/format-cellphone-number.ts
+ write  src/components/form/fields/_core/input.tsx
+ write  src/components/form/fields/text/text.tsx
+ write  src/components/form/fields/cellphone/cellphone.tsx
+ write  src/utils/validation/yup/index.ts
Generated: src/features/forms/RegistrationForm.tsx
Generated types: src/schemas/RegistrationFormFormVo.ts
```

فرم تولیدشده (خلاصه):

```tsx
import { useForm } from "react-hook-form";
import { useYupValidationResolver } from "~/utils/validation/yup";
import * as yup from "yup";
import { Text } from "~/components/form/fields/text";
import { Cellphone } from "~/components/form/fields/cellphone";

interface RegistrationFormFormVo {
  firstName: string;
  lastName: string;
  cellphone: string;
}

export default function RegistrationForm() {
  const resolver = useYupValidationResolver(
    yup.object({
      firstName: yup.string().required().trim().max(50),
      lastName: yup.string().required().trim().max(50),
      cellphone: yup.string().required().cellPhoneNumber(),
    })
  );

  const formMethods = useForm<RegistrationFormFormVo>({
    defaultValues: { firstName: undefined, lastName: undefined, cellphone: undefined },
    resolver,
  });

  const onSubmit = formMethods.handleSubmit((values) => {
    console.log("Form submitted:", values);
  });

  return (
    <form id="RegistrationForm" onSubmit={onSubmit}>
      <Text label="نام" name="firstName" control={formMethods.control} />
      <Text label="نام خانوادگی" name="lastName" control={formMethods.control} />
      <Cellphone label="شماره همراه" name="cellphone" control={formMethods.control} />
    </form>
  );
}
```

---

## ۶. تصمیم‌های طراحی و نکات ارائه

| تصمیم | چرا |
|---|---|
| **مدل رجیستری کپی‌شونده به‌جای پکیج npm** | کد مال شماست؛ قابل ویرایش، بدون قفل نسخه، بدون وابستگی زمان‌اجرا. |
| **خواندن `registry.json` به‌جای GitHub API** | یک درخواست، بدون محدودیت نرخ، مقاوم به تغییر ساختار پوشه. |
| **فایل تحلیل `.md` به‌عنوان قرارداد** | انسان‌خوان، قابل diff/review در Git، جداکننده‌ی «تصمیم» از «تولید». |
| **`overallStatus` را کد حساب می‌کند، نه LLM** | LLM نمی‌تواند گیت را دور بزند؛ هر ابهام → `needs-review`. |
| **`generateCode` کاملاً قطعی است** | خروجی قابل‌پیش‌بینی و تکرارپذیر؛ LLM فقط «می‌فهمد»، تولید نمی‌کند. |
| **محلی به‌صورت پیش‌فرض، `ANTHROPIC_*` نادیده** | بدون هزینه، بدون نشت ناخواسته‌ی کلید، مناسب CI. |
| **هرگز alias یا tsconfig را ویرایش نمی‌کند** | ابزار فقط می‌خواند؛ side-effect صفر روی پیکربندی شما. |
| **مقدار ذخیره‌شده همیشه انگلیسیِ خام** | نمایش فارسی جداست؛ اعتبارسنجی و ارسال به سرور تمیز می‌ماند. |
| **جبران مکان‌نما در `Input`** | تجربه‌ی تایپِ روان با جداکننده‌ی هزارگان و گروه‌بندی موبایل. |

---

## ۷. محدودیت‌های نسخه‌ی فعلی و نقشه‌ی راه

**محدودیت‌های امروز:**

- `init` انتخاب `zod` را می‌پذیرد، اما اسکیمای کانفیگ و `generateCode` فعلاً فقط **`yup`** را می‌سازند (زنجیره‌ی اعتبارسنج hard-coded برای yup است).
- کامپوننت‌های آماده‌ی رجیستری فقط **`text`, `cellphone`, `amount`** هستند (بدون select، checkbox، date، textarea).
- **اعتبارسنجی شرطی** (`yup.when()`) پشتیبانی نمی‌شود — عمداً برای MVP.
- `findEnumDefinition` یک stub است (برای فیلدهای مبتنی بر enum در آینده).
- فقط دو نوع فرم: `single` و `wizard`.
- فرم تولیدشده یک `<form>` خام بدون دکمه‌ی submit در حالت single و بدون استایل layout است — نقطه‌ی شروع، نه محصول نهایی.
- CLI مستقل `persian-form` (در مونوریپو) هنوز اولیه است؛ `init` آن در نسخه‌های قبلی stub بوده.

**نقشه‌ی راه محتمل:**

- پشتیبانی کامل `zod` در `generateCode`.
- کامپوننت‌های بیشتر در رجیستری (select/autocomplete، checkbox/radio، date-picker شمسی، textarea، file).
- بلوک `customize` در فایل تحلیل برای تزریق منطق دستی به فیلد.
- اعتبارسنجی شرطی کنترل‌شده.
- تولید استوری/تست همراه فرم.

---

## ۸. پیوست: پشته‌ی فناوری

**`persian-form-agent`:**

| ابزار | نسخه |
|---|---|
| Node | ≥ ۱۸ (ESM، `"type": "module"`) |
| TypeScript | ۵.۷ |
| `@anthropic-ai/sdk` | ۰.۳۹ |
| `commander` | ۱۳ (پارس دستورها) |
| `gray-matter` | ۴ (frontmatter فایل تحلیل) |
| `vitest` | ۳ (تست) |
| `tsx` | اجرای مستقیم TS در توسعه |

**`react-persian-form`:**

| ابزار | نسخه |
|---|---|
| pnpm | ۱۱ (`corepack`) |
| Turborepo | orchestrator مونوریپو |
| React | ۱۹ (playground) |
| Tailwind CSS | ۴ |
| Biome | ۱.۹ (lint/format) |
| Vitest | ۴ |
| `react-hook-form` | وابستگی همه‌ی کامپوننت‌ها |
| `yup` + `@hookform/resolvers` | لایه‌ی اعتبارسنجی |

**پروژه‌ی مقصد باید داشته باشد:** React، Tailwind CSS v4 با `@import "tailwindcss"`، `react-hook-form`، `@hookform/resolvers`، و کتابخانه‌ی اعتبارسنجی (`yup`).

---

### لینک‌های مفید

- `persian-form-agent` — [`README.md`](../README.md) · [`schemas/persian-form-agent.config.schema.json`](../schemas/persian-form-agent.config.schema.json) · [`.env.example`](../.env.example)
- `react-persian-form` — رجیستری در `registry/registry.json`، سورس کپی‌شونده در `templates/`
