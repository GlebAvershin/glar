import type { RouteDefaultsInput } from "../route/client"
import { Auth } from "../route/auth"
import type { ProviderAuthOption } from "../route/auth-options"
import { ProviderID, type ModelID } from "../schema"
import * as AnthropicMessages from "../protocols/anthropic-messages"

export const id = ProviderID.make("anthropic")

export const routes = [AnthropicMessages.route]

export type Config = RouteDefaultsInput &
  ProviderAuthOption<"optional"> & {
    readonly baseURL?: string
    /**
     * When true, send credentials as `Authorization: Bearer <key>` instead of `x-api-key`.
     * Required when routing through an OpenAI-compatible reverse proxy (e.g. LiteLLM)
     * whose Anthropic-native `/v1/messages` endpoint only parses the request body
     * correctly with Bearer auth. Default false (real api.anthropic.com).
     */
    readonly bearer?: boolean
  }

const isRealAnthropicHost = (baseURL: string | undefined): boolean => {
  if (!baseURL) return true
  try {
    return new URL(baseURL).hostname.toLowerCase() === "api.anthropic.com"
  } catch {
    return false
  }
}

const auth = (options: ProviderAuthOption<"optional"> & { bearer?: boolean; baseURL?: string }) => {
  if ("auth" in options && options.auth) return options.auth
  const credential = Auth.optional("apiKey" in options ? options.apiKey : undefined, "apiKey").orElse(
    Auth.config("ANTHROPIC_API_KEY"),
  )
  // Header selection:
  //  - Explicit `bearer: true/false`  → respect it.
  //  - Otherwise auto-detect: a custom baseURL whose hostname is not api.anthropic.com
  //    means we're behind a proxy (LiteLLM, gateway, etc.) — use Authorization: Bearer.
  //  - Real api.anthropic.com (the default, no override) always uses x-api-key.
  const useBearer = options.bearer ?? !isRealAnthropicHost(options.baseURL)
  return credential.pipe(useBearer ? Auth.bearer : Auth.header("x-api-key"))
}

const configuredRoute = (input: Config) => {
  const { apiKey: _, auth: _auth, baseURL, bearer: _bearer, ...rest } = input
  return AnthropicMessages.route.with({ ...rest, endpoint: { baseURL }, auth: auth(input) })
}

export const configure = (input: Config = {}) => {
  const route = configuredRoute(input)
  return {
    id,
    model: (modelID: string | ModelID) => route.model({ id: modelID }),
    configure,
  }
}

export const provider = configure()
export const model = provider.model
