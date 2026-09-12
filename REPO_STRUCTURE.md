# Repository Structure & Conventions — smartappsflow

This repo hosts several independent apps plus the public homepage, all served
from one domain (`smartappsflow.net`) and built by GitHub Actions.

**Read this before changing anything.** It exists so any collaborator (human or
AI) follows the same plan and does not reorganize things in a way that breaks the
established build/deploy pipeline.

**Last archive update:** 8 August 2026.

---

## 0. Start here (onboarding for a new developer or AI agent)

Read in this order, then you have the full picture:

1. **This file** (`REPO_STRUCTURE.md`) — the repo-wide plan, layout, build/deploy
   model, milestones, and remaining work. Applies to every app.
2. **The app's own deep log** — each app that has had real work keeps a detailed
   archive inside its folder. For the app you're touching, read it fully:
   - **Trade Log Pro → [`tradelogpro/PROJECT_LOG_AR.md`](tradelogpro/PROJECT_LOG_AR.md)**
     (Arabic): baseline hardening, storage map, test gate, remaining structure
     refactor (phases A/B), store polish gaps, and the deferred paid track. This is
     the single source of truth for continuing Trade Log Pro. Also see
     `tradelogpro/CHANGES_COMPLETED_AR.txt` and `tradelogpro/README_NEXT_STEPS_AR.txt`.
   - **Smart Loan → [`smartloan/PROJECT_LOG_AR.md`](smartloan/PROJECT_LOG_AR.md)**
     (Arabic): everything done, what remains (TODOs), the safe-area history and
     final fix, the calc/precision rules, the PWA update notifier, the privacy-policy
     repo, a code map of `index.html`, and the fixed rules. This is the single
     source of truth for continuing Smart Loan.
   - Smart Loan also has `smartloan/CHANGES_COMPLETED_AR.txt` and
     `smartloan/README_NEXT_STEPS_AR.txt` (older notes).
3. **The app shell** — Smart Loan remains a single `index.html`. Trade Log Pro
   phase A splits to `index.html` + `css/app.css` + `js/app.js` (classic scripts;
   still the source of truth for web and store builds).

Working rules for an agent: work on a feature branch (never `main` directly),
touch only the one app's folder, run `cd <app> && npm test` before/after changes,
and remember merging to `main` publishes the web version immediately. When you
finish a task, append it to the app's deep log **and** refresh the relevant
status section in this file so the next developer stays in sync.

---

## 0b. Smart Loan — current status (12 August 2026)

| Track | Status | Notes |
|-------|--------|--------|
| **Web PWA** | ✅ Live on `main` | `smartappsflow.net/smartloan/` — SW cache **v40** |
| **Store APK safe-area** | ✅ Verified on device | Samsung S25 Ultra / Android 15 / One UI 7 |
| **Theme-matched system bars** | ✅ Verified on device | Native Capacitor plugin `SmartLoanSystemBars` |
| **Calc / deficit / precision** | ✅ Merged | Exact values stored; round only at display |
| **PWA update notifier** | ✅ Live (web only) | Banner + Settings card; gated by `!Capacitor` |
| **Play Store upload of this build** | ✅ Live | Owner confirmed upload; store status excellent (12 Aug 2026) |
| **Target API 36 (Play policy)** | 🔄 In progress | Branch `fix/smartloan-target-api-36` — deadline 31 Aug 2026 |
| **Paid features / billing** | ⏸ Deferred | Coming Soon UI only — no Play Billing yet |

**Keep sessions separate:** Smart Loan work stays under `smartloan/` (+ its
workflow/secrets). Trade Log Pro stays under `tradelogpro/` — see §0c. Do not
mix branches or edits across apps in one session.

**Milestone completed** (branch `fix/smartloan-safearea-and-tweaks`, merged
to `main` as `51a3d72`; Play upload confirmed later):

1. Native safe-area: pad `android.R.id.content` (system bars + cutout + IME via
   `max`, not sum); CSS `--safe-*` forced to `0` only inside the Android shell
   so the browser keeps `env(safe-area-inset-*)`.
2. Theme bridge: `SystemBarsPlugin` / `SmartLoanSystemBars` colours the padded
   regions and status/nav icon contrast; confirmed light + dark themes on device.
3. Web release: bumped service worker to **v40** with user-facing CHANGELOG, then
   merged so GitHub Pages publishes the PWA.
4. Play Console: this build uploaded; listing is live / satisfactory.

**Do next for Smart Loan** (each in its own focused session — details in
`smartloan/PROJECT_LOG_AR.md` §4):

1. Finish API 36 store release: Actions build → device APK QA → Production AAB
   (`versionCode` **32** / `versionName` **3.2**, `targetSdk` **36**).
2. Before *any later* Play upload after that: bump `versionCode` again in
   `build-smartloan.yml`.
3. Optional Play Console polish: listing name / screenshots (local refs in
   `smartloan/store-graphics/` — not required for code).
4. Privacy policy content updates, if needed, in repo `smart-apps-legal` (not here).
5. Optional: tests for deficit / chart distribution display helpers.
6. Later: paid features (PDF, reschedule, multi-loan compare) + Play Billing.

### Developer / Cursor IDE (not app code)

- **Arabic RTL in Cursor chat:** ✅ working automatically (1 Aug 2026). Installed
  [`yechielby.cursor-chat-rtl` v0.1.8](https://github.com/yechielby/cursor-chat-rtl-extension)
  and patched workbench assets so RTL applies by default in Agents UI (no toolbar
  ⇄ required). After a Cursor app update, re-apply Activate / re-patch if LTR
  returns. Upstream request:
  https://forum.cursor.com/t/add-rtl-right-to-left-support-for-chat-panel/151888

---

## 0c. Trade Log Pro — current status (7 August 2026)

| Track | Status | Notes |
|-------|--------|--------|
| **Self-contained folder + workflow** | ✅ | Reference layout for new apps |
| **Baseline hardening** | ✅ | Sanitizer, Backup/Restore, analytics runtime guard |
| **Test gate** | ✅ | 80 tests (`npm test`) gating CI |
| **Web PWA** | ✅ Live; **v3 pending merge** | Phase B bumps SW to **tradelogpro-v3** |
| **Structure refactor A** | ✅ Merged (#7) | `css/app.css` + initial `js/app.js` |
| **Structure refactor B** | ✅ On branch | Classic modules: state/icons/storage/theme/finance/sanitize/app |
| **PWA icons** | ✅ Light TL mark | `icon-192.png` / `icon-512.png` (+ dark candidate kept in assets) |
| **Privacy policy file** | ✅ Added | `tradelogpro/privacy-policy.html` (Aug 8, 2026) |
| **Paid features / billing** | ⏸ Deferred | Free first; **no Coming Soon UI**; build Premium before billing |

**Milestone in progress** (branch `refactor/tradelogpro-modules`):

1. Phase A merged (`#7`); live site verified for css/js + SW v2.
2. Phase B: split into classic js modules; workflow copies `js/*.js`; SW **v3**.
3. Local verification: **80 passed, 0 failed**.

**Do next for Trade Log Pro** (each in its own focused session — details in
`tradelogpro/PROJECT_LOG_AR.md` §4):

1. Merge/verify phase B on web + Android Actions build. ✅
2. Optional deeper split of remaining `js/app.js` (views / export) later.
3. Add Trade Log–specific PWA icons; restore manifest icons + apple-touch link. ✅ (light TL)
4. ✅ `tradelogpro/privacy-policy.html` added (register URL in Play when publishing).
5. Later (per Claude handoff): phase C Vite; phase D sync/billing. **Do not** ship
   Coming Soon / paywalls before Premium features exist.

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
├── REPO_STRUCTURE.md     # this file (repo-wide archive + onboarding)
│
├── tradelogpro/          # ✅ fully self-contained (reference model); deep log: PROJECT_LOG_AR.md
├── smartloan/            # ✅ fully self-contained; deep log: PROJECT_LOG_AR.md
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

**Smart Loan web update ritual:** edit `smartloan/index.html` (if needed) → bump
`VERSION` + rewrite `CHANGELOG` in `smartloan/service-worker.js` → merge to
`main`. Users on the old PWA get an in-app update banner (consent required).

**Smart Loan store build ritual:** Actions → «Build Smart Loan AAB» →
[workflow link](https://github.com/Almamar4ev/smartappsflow/actions/workflows/build-smartloan.yml)
→ Run workflow (choose branch) → download AAB/APK artifacts → upload AAB in
Play Console when ready.

### 4a. Version numbering — applies to every app, current and future

Two numbers, two different jobs. Never derive one from the other.

| | Who sets it | Value | Who sees it |
|---|---|---|---|
| `versionCode` | the workflow, automatically | `${GITHUB_RUN_NUMBER}` | nobody — Play uses it only to order builds |
| `versionName` | **you**, by hand | `version` field of the app's `package.json` | users, and every Play Console report |

Play requires only one thing: `versionCode` must always increase and can never
be reused. The run number satisfies that for free, so no build ever needs a
manual bump to be uploadable.

`versionName` is a deliberate decision, never a counter. Deriving it from the
run number (the old `1.0.${GITHUB_RUN_NUMBER}` pattern, fixed in Edgeory on
12 September 2026) makes the first public release look like `1.0.37`, skips
numbers whenever a run fails, and splits one release into many names in the
crash and statistics reports.

Bump `versionName` as `MAJOR.MINOR.PATCH`, resetting everything to the right of
the number you raise:

- **PATCH** — bug fixes only, no new feature: `1.0.0` → `1.0.1`
- **MINOR** — a new feature that breaks nothing: `1.0.2` → `1.1.0`
- **MAJOR** — redesign, forced migration, or a break in stored data: `1.2.0` → `2.0.0`

So a feature shipped after `1.1.1` becomes `1.2.0`, not `1.2.1`.

How to bump, from inside the app folder:

```bash
npm version patch --no-git-tag-version   # or minor / major
```

Forgetting to bump breaks nothing: the build just carries the same
`versionName` with a new `versionCode`, which is exactly what you want for a
string of fix builds inside one test round.

**Play Console release name:** always `versionName (versionCode)` — e.g.
`1.0.0 (38)`. The name is internal, and Play reports crashes per `versionCode`,
so keeping the code in the name links a release to its reports instantly.

---

## 5. Known pending work (do each in its own focused session)

### Trade Log Pro (next sessions — see also `tradelogpro/PROJECT_LOG_AR.md` §4)
- PWA icons (`icon-192` / `icon-512`) + manifest / apple-touch restore.
- Device QA + Play listing when ready (privacy policy file is in-repo).
- Optional: deeper `app.js` splits; later Vite (phase C) / sync+billing (phase D).
- Deferred Premium: build real features first; **no Coming Soon** placeholders.

### Smart Loan (next sessions — store already live)
See also the checkbox list in [`smartloan/PROJECT_LOG_AR.md`](smartloan/PROJECT_LOG_AR.md) §4:

- Finish Play policy fix: ship `targetSdk` **36** / version **3.2 (32)** to Production.
- Bump store `versionCode` / `versionName` before any *later* Play upload.
- Optional Play Console polish: listing title + screenshots.
- Privacy policy content updates in **`smart-apps-legal`** when needed.
- Optional display-helper tests (deficit, chart distribution).
- Deferred product work: PDF, reschedule, multi-loan compare + Play Billing.

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
6. After finishing a milestone, update **this file** (§0b / §5) and the app's
   deep log so the next session can resume without rediscovering history.
7. Follow §4a for version numbers in every app: `versionCode` stays automatic,
   `versionName` is bumped by hand in `package.json`, and a workflow must never
   build `versionName` out of the run number.
