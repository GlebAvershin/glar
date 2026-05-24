# Fork patches over upstream opencode

This document tracks every modification made to the vendored `anomalyco/opencode` source.
Keep this list short — anything that can live OUTSIDE the fork (separate packages, config
files, plugin registrations) should live outside. Each entry below is a real reason to
patch upstream code, not a preference.

## Branch model

- `origin/dev` — fork's mirror of `anomalyco/opencode:dev`. Synced manually via `git fetch upstream`.
- `ourapp/main` — our active branch, rebased on top of `origin/dev`. All patches live here.

To pull upstream updates:

```bash
git fetch upstream dev
git checkout ourapp/main
git rebase upstream/dev
# Resolve any conflicts in files listed below — they should be minimal.
bun scripts/verify-bearer-patch.ts   # confirm Bearer heuristic still works
bun --cwd packages/doc-tools test    # confirm doc-tools still works
git push --force-with-lease origin ourapp/main
```

## Local dev setup (Windows nuance)

The opencode upstream uses **symlinks** in a few `.d.ts` files (e.g.
`packages/enterprise/src/custom-elements.d.ts` → `../../ui/src/custom-elements.d.ts`).
Without these symlinks, `bun turbo typecheck` (run by the husky `pre-push` hook)
fails with `TS1128: Declaration or statement expected.`

**On Windows**, real symlinks require either:

1. **Developer Mode ON** (recommended) — `Settings → System → For developers → Developer Mode`,
   then re-clone the fork. This is a one-time setup. Git will then create proper symlinks.
2. **Running git as admin** — possible but inconvenient.
3. **`--no-verify` on push** — bypasses the hook (use only when the failures are
   upstream-attributed Windows symlink stubs, not regressions in our code).

On Mac/Linux this is not an issue.

If you see typecheck errors **only in upstream files we haven't touched**
(`packages/enterprise/...`, `packages/sdk/js/...`), it's almost certainly the
Windows symlink issue. Errors in `packages/doc-tools/...` or our patched files
in `packages/llm` / `packages/opencode` are real regressions — fix before push.

## Patches

### 1. `packages/llm/src/providers/anthropic.ts` — Bearer auth auto-detect

**Why.** opencode's Anthropic provider hardcodes `x-api-key` as the auth header,
which is correct for `api.anthropic.com` but breaks when the user routes through
LiteLLM Proxy (our Gateway). LiteLLM's Anthropic-native `/v1/messages` endpoint
parses the request body correctly only with `Authorization: Bearer`.

**Change.** Added `isRealAnthropicHost()` helper and replaced the auth header
selection with:

```ts
const useBearer = options.bearer ?? !isRealAnthropicHost(options.baseURL)
return credential.pipe(useBearer ? Auth.bearer : Auth.header("x-api-key"))
```

- If `baseURL.hostname === "api.anthropic.com"` (or unset) → `x-api-key` (default).
- Otherwise → `Authorization: Bearer`.
- Explicit `bearer: true/false` option overrides the heuristic.

Backwards compatible: existing Anthropic users see no change.

**Test:** `bun scripts/verify-bearer-patch.ts` — 8 cases covering default,
local Gateway, production Gateway, real Anthropic, lookalike domains, and
explicit overrides.

### 2. `packages/opencode/src/config/provider.ts` — `bearer` config field

**Why.** Exposes the new `bearer` option in the user-facing `opencode.json` config
schema so it can be set without TS errors:

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "http://localhost:4000",
        "bearer": true  // ← new field, optional
      }
    }
  }
}
```

**Change.** Added one optional field to the `Info.options` schema.

### 3. `.opencode/opencode.jsonc` — local Gateway config scaffold

**Why.** Default config for the desktop dev session — points Anthropic provider at
the local LiteLLM Gateway and uses the patched Bearer auth. Drop your Billing-issued
virtual_key into `apiKey`.

**Not a patch to upstream code** — this is project-level config that doesn't conflict
with anything in upstream's empty `.opencode/opencode.jsonc`.

## Not patched (deliberately, things to add outside the fork)

- **Document tools** (PDF/DOCX/XLSX parsers, DOCX generator) — now live in
  `packages/doc-tools/` as a new workspace package, registered as an opencode plugin
  via `opencode.jsonc` and `packages/opencode/package.json` (one workspace dep). No
  changes to upstream `packages/llm` or `packages/opencode/src/`.
- **Rebranding** (icons, app name, splash) — these are asset files and a few strings;
  not architectural patches. Done at packaging time via electron-builder config and
  i18n strings. Will be applied closer to public release.
- **Russian localization** — `packages/desktop/src/renderer/i18n/ru.ts` already exists
  upstream and is at parity (27 lines, matches en.ts). Translations may need
  refinement for our domain (legal/accounting wording) but the file structure is upstream.
- **Hiding dev features** (terminal panel, file-tree, code-diff) — done via runtime
  config / feature flags, not by removing code. Not yet implemented.

## How to verify a fork merge didn't break anything

```bash
# 1. Heuristic still passes
bun scripts/verify-bearer-patch.ts

# 2. Type check (after bun install)
bun turbo typecheck

# 3. Provider tests
bun --cwd packages/llm test src/providers/anthropic
```
