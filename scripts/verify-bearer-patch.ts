#!/usr/bin/env bun
/**
 * Verify the auth-header heuristic logic from the patched
 *   packages/llm/src/providers/anthropic.ts
 *
 * Self-contained — does not import opencode packages, so it runs offline
 * before any `bun install`. Mirrors the logic exactly; keep in sync with
 * the real provider patch.
 */

interface Config {
  apiKey?: string
  baseURL?: string
  bearer?: boolean
}

/**
 * COPY OF the heuristic in anthropic.ts — MUST stay in sync.
 * If anthropic.ts changes, update here and vice versa.
 */
function isRealAnthropicHost(baseURL: string | undefined): boolean {
  if (!baseURL) return true
  try {
    return new URL(baseURL).hostname.toLowerCase() === "api.anthropic.com"
  } catch {
    return false
  }
}

function pickHeader(options: Config): "Authorization: Bearer" | "x-api-key" {
  const useBearer = options.bearer ?? !isRealAnthropicHost(options.baseURL)
  return useBearer ? "Authorization: Bearer" : "x-api-key"
}

interface Case {
  name: string
  config: Config
  expect: "x-api-key" | "Authorization: Bearer"
}

const cases: Case[] = [
  {
    name: "Default (no baseURL) → x-api-key",
    config: { apiKey: "sk-ant-test" },
    expect: "x-api-key",
  },
  {
    name: "Custom local Gateway baseURL → Bearer (auto-detect)",
    config: { apiKey: "sk-virtual", baseURL: "http://localhost:4000" },
    expect: "Authorization: Bearer",
  },
  {
    name: "Production Gateway HTTPS → Bearer",
    config: { apiKey: "sk-virtual", baseURL: "https://gw.ourapp.com" },
    expect: "Authorization: Bearer",
  },
  {
    name: "Real api.anthropic.com explicit → x-api-key",
    config: { apiKey: "sk-ant-test", baseURL: "https://api.anthropic.com" },
    expect: "x-api-key",
  },
  {
    name: "Real api.anthropic.com with path → x-api-key",
    config: { apiKey: "sk-ant-test", baseURL: "https://api.anthropic.com/v1" },
    expect: "x-api-key",
  },
  {
    name: "Lookalike api.anthropic.com.cn → Bearer (NOT real Anthropic)",
    config: { apiKey: "sk-x", baseURL: "https://api.anthropic.com.cn" },
    expect: "Authorization: Bearer",
  },
  {
    name: "Explicit bearer:false on Gateway → x-api-key (override auto-detect)",
    config: { apiKey: "sk-x", baseURL: "http://localhost:4000", bearer: false },
    expect: "x-api-key",
  },
  {
    name: "Explicit bearer:true on real Anthropic → Bearer (override)",
    config: { apiKey: "sk-x", baseURL: "https://api.anthropic.com", bearer: true },
    expect: "Authorization: Bearer",
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const actual = pickHeader(c.config)
  const ok = actual === c.expect
  console.log(`${ok ? "✓" : "✗"}  ${c.name}`)
  if (!ok) {
    console.log(`   expected: ${c.expect}`)
    console.log(`   actual:   ${actual}`)
    failed++
  } else {
    passed++
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
