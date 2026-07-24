# Repository Structure & Conventions — smartappsflow

This repo hosts several independent apps plus the public homepage, all served
from one domain (`smartappsflow.net`) and built by GitHub Actions.

**Read this before changing anything.** It exists so any collaborator (human or
AI) follows the same plan and does not reorganize things in a way that breaks the
established build/deploy pipeline.

---

## 1. Guiding principle: one self-contained folder per app

Every app lives in **its own top-level folder** and owns **everything** it needs.
Apps never share source, config, or signing secrets. `tradelogpro/` is the
reference model — copy its shape for any new app:

```
<app>/
├── index.html                 # the app
├── manifest.json, sw.js       # PWA files (if it is a PWA)
├── package.json               # name + "test" script
├── capacitor.config.json      # appId + appName (native build)
├── .gitignore                 # node_modules/  www/  android/
├── SHA256SUMS.txt             # integrity hashes of the app's files
├── privacy-policy.html        # REQUIRED before Play Store publishing
└── tests/                     # tests that gate the build
```

Plus, outside the folder:
- `.github/workflows/build-<app>.yml` — a dedicated workflow.
- Dedicated Actions secrets named `<APP>_KEYSTORE_BASE64`, `<APP>_KEYSTORE_PASSWORD`,
  `<APP>_KEY_ALIAS`, `<APP>_KEY_PASSWORD`. **Never reuse another app's secret names.**
- A line in root `.gitattributes` forcing `eol=lf` for that folder (keeps
  `SHA256SUMS.txt` verifiable on every OS).

---

## 2. Current layout

```
smartappsflow/
├── index.html            # public homepage (smartappsflow.net) — NOT an app
├── CNAME                 # custom-domain binding
├── .gitattributes        # line-ending rules (LF for app sources)
├── REPO_STRUCTURE.md     # this file
│
├── tradelogpro/          # ✅ fully self-contained (reference model)
├── smartloan/            # ✅ fully self-contained (own privacy-policy.html)
├── carmaintenance/       # PWA only (web)
├── compoundcalc/         # Flutter build output (web)
│
└── .github/workflows/
    ├── build-tradelogpro.yml
    └── build-smartloan.yml
```

---

## 3. Signing secrets (per app, never shared)

| App          | Secret names |
|--------------|--------------|
| TradeLog Pro | `TRADELOG_KEYSTORE_BASE64`, `TRADELOG_KEYSTORE_PASSWORD`, `TRADELOG_KEY_ALIAS`, `TRADELOG_KEY_PASSWORD` |
| Smart Loan   | `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` |

Signing keystores are **never** committed. They live outside the repo and are
provided to CI only through these secrets. Sharing secret names between apps
caused a real signing bug once — keep them separate.

---

## 4. Build & deploy model — what "merge to main" does

There are TWO outputs, built on different triggers:

| Output | Trigger | Automatic? | Result |
|--------|---------|-----------|--------|
| **Web (PWA / GitHub Pages)** | merge to `main` | ✅ fully automatic | published live to the public site immediately |
| **Store binary (APK/AAB)** | push to `main` (`build-<app>.yml`) | ✅ built + signed automatically | uploaded as a **workflow artifact**; store upload stays **manual** |

So, merging a change to `main`:
- **Web** → deployed to the public site right away. Only merge web-ready changes.
- **APK/AAB** → built and signed, then waits in the run's *Artifacts*. You
  download and upload it to Google Play yourself, when ready.

Each app workflow is path-scoped (`<app>/**`) so it only runs when that app
changes. Pull requests run tests + an unsigned build; **signing runs only on
trusted `push`/`workflow_dispatch` events, never on pull_request.**

---

## 5. Known pending work (do each in its own focused session)

- **TradeLog Pro privacy policy**: create `tradelogpro/privacy-policy.html`
  before publishing to the Play Store.

Smart Loan's **published** privacy policy — the URL registered in Google Play
Console — lives in a **separate repo** (`smart-apps-legal`), served from GitHub
Pages at:
`https://almamar4ev.github.io/smart-apps-legal/smart-loan-calculator/privacy-policy.html`
That repo is the source of truth for the store; update it there (done manually,
outside this repo). The `smartloan/privacy-policy.html` file kept here is a
convenience copy of the same content — it is not the registered store URL.

---

## 6. Rules for collaborators

1. Stay inside one app's folder per task; do not touch other apps.
2. Never share signing-secret names across apps.
3. Keep each app self-contained (follow the `tradelogpro/` shape).
4. Remember: merging to `main` publishes the web version immediately.
5. When adding a new app, replicate the full pattern in §1 (folder + workflow +
   secrets + `.gitattributes` line + privacy policy).
