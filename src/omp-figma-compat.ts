/**
 * Extracted/adapted from oh-my-pi 17.3.4:
 *   src/mcp/oauth-flow.ts
 *   src/mcp/oauth-discovery.ts
 *
 * This file keeps only the provider-compatibility seam. It is not a drop-in
 * replacement for OMP's full OAuth implementation.
 */

export type OAuthMetadata = {
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
  client_id?: string
  clientId?: string
  default_client_id?: string
  public_client_id?: string
  scopes_supported?: string[]
}

export type RegistrationFailure = {
  endpoint: string
  status: number
  detail?: string
}

/** OMP's static-client resolution: config first, then client_id in the auth URL. */
export function staticClientIdFromConfig(input: {
  clientId?: string
  authorizationUrl: string
}): string | undefined {
  const fromConfig = input.clientId?.trim()
  if (fromConfig) return fromConfig

  try {
    return new URL(input.authorizationUrl).searchParams.get('client_id') ?? undefined
  } catch {
    return undefined
  }
}

/**
 * OMP's metadata compatibility: accept the provider's common client-ID field
 * variants, including Figma's public/default-client forms.
 */
export function clientIdFromMetadata(metadata: OAuthMetadata): string | undefined {
  return (
    metadata.client_id ??
    metadata.clientId ??
    metadata.default_client_id ??
    metadata.public_client_id
  )
}

/** OMP records Figma's DCR rejection rather than treating it as a transient error. */
export function recordRegistrationFailure(
  endpoint: string,
  status: number,
  detail?: string
): RegistrationFailure {
  return { endpoint, status, detail }
}

/**
 * OMP's definitive Figma check. HTTP 403 alone is intentionally insufficient;
 * the provider must identify the client as unapproved.
 */
export function isDefinitiveRegistrationRejection(
  failure?: RegistrationFailure
): boolean {
  return failure?.status === 403 && /\bunapproved_client\b/i.test(failure.detail ?? '')
}

/**
 * The manual fallback OMP tells the operator to use after Figma rejects DCR.
 * Credentials are deliberately supplied by the operator/configuration layer.
 */
export function manualClientConfigHint(failure?: RegistrationFailure): string {
  if (!failure) {
    return 'Configure oauth.clientId (and oauth.clientSecret if required) in mcp.json.'
  }

  const outcome = failure.status
    ? `HTTP ${failure.status}${failure.detail ? ` — ${failure.detail}` : ''}`
    : `network error${failure.detail ? ` — ${failure.detail}` : ''}`

  return (
    `Dynamic client registration was rejected (POST ${failure.endpoint} → ${outcome}). ` +
    'Configure oauth.clientId (and oauth.clientSecret if required) in mcp.json.'
  )
}

/** OMP adds the resolved client_id to the authorization URL and uses PKCE. */
export function buildAuthorizationUrl(input: {
  authorizationUrl: string
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scopes?: string
}): string {
  const url = new URL(input.authorizationUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (input.scopes) url.searchParams.set('scope', input.scopes)
  return url.toString()
}
