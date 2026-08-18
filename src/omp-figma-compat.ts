/**
 * Small, sanitized extraction of OMP 17.3.4's Figma OAuth seam.
 * Not a replacement for OMP's full OAuth implementation.
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

/** Prefer configured identity; otherwise preserve one already in the auth URL. */
export function staticClientIdFromConfig({
  clientId,
  authorizationUrl,
}: {
  clientId?: string
  authorizationUrl: string
}): string | undefined {
  const configured = clientId?.trim()
  if (configured) return configured

  try {
    return new URL(authorizationUrl).searchParams.get('client_id') ?? undefined
  } catch {
    return undefined
  }
}

/** Accept the client-ID names used by OAuth providers. */
export function clientIdFromMetadata(
  metadata: OAuthMetadata,
): string | undefined {
  return (
    metadata.client_id ??
    metadata.clientId ??
    metadata.default_client_id ??
    metadata.public_client_id
  )
}

export function recordRegistrationFailure(
  endpoint: string,
  status: number,
  detail?: string,
): RegistrationFailure {
  return { endpoint, status, detail }
}

/** A bare 403 is not enough; OMP requires the provider's error detail too. */
export function isDefinitiveRegistrationRejection(
  failure?: RegistrationFailure,
): boolean {
  return failure?.status === 403 && /\bunapproved_client\b/i.test(failure.detail ?? '')
}

export function manualClientConfigHint(
  failure?: RegistrationFailure,
): string {
  if (!failure) {
    return 'Configure oauth.clientId and, if required, oauth.clientSecret in mcp.json.'
  }

  const outcome = failure.status
    ? `HTTP ${failure.status}${failure.detail ? ` — ${failure.detail}` : ''}`
    : `network error${failure.detail ? ` — ${failure.detail}` : ''}`

  return (
    `Dynamic client registration was rejected ` +
    `(POST ${failure.endpoint} → ${outcome}). ` +
    'Configure oauth.clientId and, if required, oauth.clientSecret in mcp.json.'
  )
}

/** Build OMP's Authorization Code + PKCE URL. */
export function buildAuthorizationUrl({
  authorizationUrl,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scopes,
}: {
  authorizationUrl: string
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scopes?: string
}): string {
  const url = new URL(authorizationUrl)
  const params = url.searchParams

  params.set('response_type', 'code')
  params.set('client_id', clientId)
  params.set('redirect_uri', redirectUri)
  params.set('state', state)
  params.set('code_challenge', codeChallenge)
  params.set('code_challenge_method', 'S256')
  if (scopes) params.set('scope', scopes)

  return url.toString()
}
