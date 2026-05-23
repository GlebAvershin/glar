/**
 * Public surface of @ourapp/doc-tools.
 *
 * Two ways to consume:
 *   1. As pure functions:   import { parsePdf, generateDocx } from "@ourapp/doc-tools"
 *   2. As opencode plugin:  import { DocToolsPlugin } from "@ourapp/doc-tools/plugin"
 */
export * from "./types.ts"
export * from "./parsers/index.ts"
export * from "./generators/index.ts"
